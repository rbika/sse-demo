import { runStream } from '@/server/run-stream'

export const dynamic = 'force-dynamic'

const STEP_DURATION = 1800

const waitForStep = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, STEP_DURATION)
  })

export function GET(request: Request) {
  return runStream(request, waitForStep)
}
