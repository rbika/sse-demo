import type { Snapshot, Status } from '@/types/pipeline'

// The ordered Steps of the Pipeline.
const PIPELINE = [
  'Cloning',
  'Installing dependencies',
  'Linting',
  'Testing',
  'Building',
  'Deploying',
] as const

// Idle Snapshot: no Run yet or after a dropped connection. Every Step is pending.
const IDLE_SNAPSHOT: Snapshot = PIPELINE.map((name) => ({
  name,
  status: 'pending',
}))

// A Run is Terminal once all Steps have one of these statuses.
const TERMINAL_STATUSES: Status[] = ['completed', 'failed', 'skipped']
const isTerminalSnapshot = (snapshot: Snapshot) =>
  snapshot.length > 0 &&
  snapshot.every((step) => TERMINAL_STATUSES.includes(step.status))

export { IDLE_SNAPSHOT, isTerminalSnapshot, PIPELINE }
