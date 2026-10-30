import type { Outcome, Snapshot } from '@/types/pipeline'
import { PIPELINE } from '@/utils/pipeline'

// Defines the index of the Step that will fail.
const FAIL_STEP_INDEX = PIPELINE.indexOf('Testing')

// Formats a Pipeline Snapshot as a named SSE event.
// SSE fields are separated by newlines, and a blank line ends each event.
const encodeRunEvent = (snapshot: Snapshot) =>
  `event: run\ndata: ${JSON.stringify(snapshot)}\n\n`

// Creates a Snapshot of the Pipeline.
const getPipelineSnapshot = (completedCount: number): Snapshot =>
  PIPELINE.map((name, index) => {
    if (index < completedCount) {
      return { name, status: 'completed' }
    }

    if (index === completedCount) {
      return { name, status: 'running' }
    }

    return { name, status: 'pending' }
  })

// Creates the error Terminal Snapshot.
const getErrorTerminalSnapshot = (): Snapshot =>
  PIPELINE.map((name, index) => {
    if (index < FAIL_STEP_INDEX) {
      return { name, status: 'completed' }
    }
    if (index === FAIL_STEP_INDEX) {
      return { name, status: 'failed' }
    }
    return { name, status: 'skipped' }
  })

// Next.js Route Handler that streams Snapshots as SSE.
export function runStream(
  request: Request,
  wait: () => Promise<void>,
): Response {
  // Extracts the outcome parameter from the request URL.
  const outcomeParam = new URL(request.url).searchParams.get('outcome')
  if (outcomeParam !== 'success' && outcomeParam !== 'error') {
    return new Response(null, { status: 400 })
  }
  const outcome: Outcome = outcomeParam

  // Converts strings into bytes, which the response stream requires.
  const encoder = new TextEncoder()

  // Creates a stream that produces data incrementally.
  const stream = new ReadableStream({
    async start(controller) {
      // Serializes a Snapshot and adds it to the response stream.
      const enqueue = (snapshot: Snapshot) => {
        controller.enqueue(encoder.encode(encodeRunEvent(snapshot)))
      }

      const handleAbort = new Promise<void>((resolve) => {
        if (request.signal.aborted) {
          resolve()
          return
        }
        request.signal.addEventListener('abort', () => resolve(), {
          once: true,
        })
      })

      // Determines the index of the last running Step based on the
      // Outcome.
      const lastRunningIndex =
        outcome === 'error' ? FAIL_STEP_INDEX : PIPELINE.length - 1

      // Send the first Snapshot of the Run, then a Snapshot after each
      // Step transition. The last loop iteration still has a running Step.
      // The Terminal Snapshot is sent after the loop.
      for (
        let completedCount = 0;
        completedCount <= lastRunningIndex;
        completedCount++
      ) {
        // Sends a Snapshot of the Pipeline.
        enqueue(getPipelineSnapshot(completedCount))

        // Waits before the next Snapshot, but aborts if the request
        // is aborted.
        await Promise.race([wait(), handleAbort])
        if (request.signal.aborted) {
          controller.close()
          return
        }
      }

      // Sends the Terminal Snapshot.
      enqueue(
        outcome === 'error'
          ? getErrorTerminalSnapshot()
          : getPipelineSnapshot(PIPELINE.length),
      )

      // Signals that no more events will be sent.
      controller.close()
    },
  })

  // Returns the stream with headers identifying it as an SSE response.
  // The Content-Type header identifies the response as an SSE stream.
  // The Cache-Control header discourages caching and intermediary
  // transformations that could interfere with streaming.
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
