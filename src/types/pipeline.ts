import { PIPELINE } from '@/utils/pipeline'

type Status = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

type Step = { name: (typeof PIPELINE)[number]; status: Status }

type Snapshot = Step[]

type Outcome = 'success' | 'error'

export type { Outcome, Snapshot, Status, Step }
