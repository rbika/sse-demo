'use client'

import { useEffect, useRef, useState } from 'react'

import { EventStream } from '@/components/event-stream'
import { PipelineSteps } from '@/components/pipeline-steps'
import { toast } from '@/components/ui/toast'
import type { Outcome, Snapshot } from '@/types/pipeline'
import { apiPaths } from '@/utils/paths'
import { IDLE_SNAPSHOT, isTerminalSnapshot } from '@/utils/pipeline'

// Rebuild the SSE text so EventStream can show what actually arrived.
const toEventStreamText = (data: string) => `event: run\ndata: ${data}`

// SseEventSource component
const SseEventSource = ({
  onInProgressChange,
}: {
  onInProgressChange: (inProgress: boolean) => void
}) => {
  const [steps, setSteps] = useState<Snapshot>(IDLE_SNAPSHOT)
  const [events, setEvents] = useState<string[]>([])
  const [inProgress, setInProgress] = useState(false)

  // Keep the instance so we can close() it on unmount, when the current
  // Run becomes Terminal, and on error.
  const eventSourceRef = useRef<EventSource | null>(null)

  // Event listeners close over the render that created them, so
  // `inProgress` state would be stale inside onerror. The ref is the
  // live "a current Run" flag those listeners can read.
  const inProgressRef = useRef(false)

  // Close the EventSource and mark that there is no current Run. Used
  // when the current Run becomes Terminal and on error.
  const stopRun = () => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    inProgressRef.current = false
    setInProgress(false)
    onInProgressChange(false)
  }

  // On unmount, close the EventSource so the browser drops the SSE
  // connection.
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      onInProgressChange(false)
    }
  }, [onInProgressChange])

  // Start a new Run. This function is called when the user clicks the
  // Simulate Success or Simulate Error button.
  const startRun = (outcome: Outcome) => {
    // Guard against a second click.
    if (inProgressRef.current) {
      return
    }

    inProgressRef.current = true
    setInProgress(true)
    onInProgressChange(true)
    setEvents([])

    // Start the SSE connection by creating an EventSource.
    const eventSource = new EventSource(apiPaths.run() + `?outcome=${outcome}`)
    eventSourceRef.current = eventSource

    // Named events: the server sends `event: run`, so we listen for "run".
    eventSource.addEventListener('run', (event: MessageEvent<string>) => {
      const snapshot = JSON.parse(event.data) as Snapshot
      setSteps(snapshot)
      setEvents((current) => [...current, toEventStreamText(event.data)])

      if (!isTerminalSnapshot(snapshot)) {
        return
      }

      // EventSource reconnects automatically when the server closes the
      // stream. We saw a Terminal Snapshot, so close it ourselves instead
      // of letting it retry GET /api/run.
      stopRun()

      if (outcome === 'error') {
        toast.add({ type: 'error', title: 'Testing failed.' })
      } else {
        toast.add({ type: 'success', title: 'Every Step completed.' })
      }
    })

    eventSource.onerror = () => {
      const droppedMidRun = inProgressRef.current
      stopRun()

      // onerror fires for real network drops *and* when the server closes
      // the stream after a Terminal Snapshot. Use the ref to tell those
      // apart: if we already marked the Run Terminal, ignore this.
      if (!droppedMidRun) {
        return
      }

      // If there was still a current Run, the connection died mid-Run.
      // Return to Idle.
      setSteps(IDLE_SNAPSHOT)

      toast.add({ type: 'error', title: 'Connection lost. Please try again.' })
    }
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

export { SseEventSource }
