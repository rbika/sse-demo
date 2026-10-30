'use client'

import { useEffect, useRef, useState } from 'react'

import { EventStream } from '@/components/event-stream'
import { PipelineSteps } from '@/components/pipeline-steps'
import { toast } from '@/components/ui/toast'
import type { Outcome, Snapshot } from '@/types/pipeline'
import { apiPaths } from '@/utils/paths'
import { IDLE_SNAPSHOT, isTerminalSnapshot } from '@/utils/pipeline'

type SseEvent = { event: string; data: string }

// Rebuild the SSE text so EventStream can show what actually arrived.
const toEventStreamText = (data: string) => `event: run\ndata: ${data}`

// Minimal parser for the article's server, not a general SSE parser.
// That server writes `event: run\ndata: <json>\n\n`. Network chunks
// don't line up with events, so leftover text comes back as `rest`.
const consumeSseEvents = (
  buffer: string,
): { events: SseEvent[]; rest: string } => {
  // Fetch gives you a raw byte stream — unlike EventSource, it does not
  // parse SSE for you. One chunk can hold several of those events, or a
  // single event can be split across two chunks. Split on `\n\n`.
  const chunks = buffer.split('\n\n')

  // Trailing fragment to prepend onto the next chunk.
  const rest = chunks.pop() ?? ''

  const events: SseEvent[] = []

  // Emit every complete event.
  for (const chunk of chunks) {
    let event = 'message'
    const data: string[] = []

    // Only `event:` and `data:` — that's all this server sends.
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trimStart()
        continue
      }
      if (line.startsWith('data:')) {
        data.push(line.slice(5).trimStart())
      }
    }

    if (data.length === 0) {
      continue
    }

    events.push({ event, data: data.join('\n') })
  }

  return { events, rest }
}

// SseFetch component
const SseFetch = ({
  onInProgressChange,
}: {
  onInProgressChange: (inProgress: boolean) => void
}) => {
  const [steps, setSteps] = useState<Snapshot>(IDLE_SNAPSHOT)
  const [events, setEvents] = useState<string[]>([])
  const [inProgress, setInProgress] = useState(false)

  // Fetch is cancelled with AbortController (EventSource uses close()).
  // Keep the controller so we can abort() on unmount, when the current Run
  // becomes Terminal, and on error.
  const abortControllerRef = useRef<AbortController | null>(null)

  // Event listeners close over the render that created them, so
  // `inProgress` state would be stale inside onerror. The ref is the
  // live "a current Run" flag those listeners can read.
  const inProgressRef = useRef(false)

  // Abort the fetch and mark that there is no current Run. Used when the
  // current Run becomes Terminal and on error.
  const stopRun = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    inProgressRef.current = false
    setInProgress(false)
    onInProgressChange(false)
  }

  // On unmount, abort the fetch so the browser drops the SSE connection.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      onInProgressChange(false)
    }
  }, [onInProgressChange])

  // Start a new Run. Called when the user clicks Simulate Success or
  // Simulate Error.
  const startRun = (outcome: Outcome) => {
    // Guard against a second click.
    if (inProgressRef.current) {
      return
    }

    inProgressRef.current = true
    setInProgress(true)
    onInProgressChange(true)
    setEvents([])

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Start the fetch request.
    void (async () => {
      try {
        const response = await fetch(apiPaths.run() + `?outcome=${outcome}`, {
          // Tie this request to the controller so stopRun() / unmount can
          // cancel it. Without a signal, the read loop keeps running after
          // we consider the Run finished.
          signal: abortController.signal,
          // An event stream must never be served from cache.
          cache: 'no-store',
          // Tell the server (and any proxy) we want SSE, not a
          // regular JSON response. EventSource sets this header
          // automatically.
          headers: { Accept: 'text/event-stream' },
        })

        // A non-OK status or a missing body means we never got a stream.
        // Throw so the catch path treats it like a dropped connection.
        if (!response.ok || !response.body) {
          throw new Error('Connection lost. Please try again.')
        }

        // getReader() unlocks the body as chunks of bytes.
        const reader = response.body.getReader()

        // TextDecoder turns those bytes into a string.
        const decoder = new TextDecoder()

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          // done equals true means the server closed the stream.
          // Fetch does not reconnect (EventSource would).
          if (done) {
            const droppedMidRun = inProgressRef.current
            stopRun()

            // We already called stopRun() after a Terminal Snapshot.
            // The stream ending is expected — ignore it.
            if (!droppedMidRun) {
              return
            }

            // inProgressRef is still true: the connection died mid-Run.
            // Return the Pipeline to Idle and tell the user.
            setSteps(IDLE_SNAPSHOT)
            toast.add({
              type: 'error',
              title: 'Connection lost. Please try again.',
            })
            return
          }

          // Append this chunk, peel off every complete event, and keep
          // the leftover fragment in `buffer` for the next read.
          buffer += decoder.decode(value, { stream: true })
          const parsed = consumeSseEvents(buffer)
          buffer = parsed.rest

          for (const event of parsed.events) {
            // Named events: the server sends `event: run`. Skip comments,
            // heartbeats, and any other event name. EventSource does this
            // filter for you via addEventListener('run', ...).
            if (event.event !== 'run') {
              continue
            }

            const snapshot = JSON.parse(event.data) as Snapshot
            setSteps(snapshot)
            setEvents((current) => [...current, toEventStreamText(event.data)])

            if (!isTerminalSnapshot(snapshot)) {
              continue
            }

            // Fetch does not reconnect when the server closes the stream,
            // but abort anyway so a late chunk cannot update state after
            // the toast.
            stopRun()

            if (outcome === 'error') {
              toast.add({ type: 'error', title: 'Testing failed' })
            } else {
              toast.add({ type: 'success', title: 'Every Step completed' })
            }

            return
          }
        }
      } catch {
        // abort() rejects the fetch with AbortError. That is expected when
        // we stop a Terminal Run or unmount. Ignore it. Any other
        // rejection during a Run is a dropped connection (network
        // error, 5xx, etc.).
        if (abortController.signal.aborted) {
          return
        }

        const droppedMidRun = inProgressRef.current
        stopRun()

        if (!droppedMidRun) {
          return
        }

        setSteps(IDLE_SNAPSHOT)
        toast.add({
          type: 'error',
          title: 'Connection lost. Please try again.',
        })
      }
    })()
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-1">
      <PipelineSteps
        steps={steps}
        inProgress={inProgress}
        onStartRun={startRun}
      />
      <EventStream events={events} />
    </div>
  )
}

export { SseFetch }
