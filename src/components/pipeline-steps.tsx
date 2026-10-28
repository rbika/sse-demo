import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  CircleXIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Outcome, Snapshot, Status } from '@/types/pipeline'

const StepIcon = ({ status }: { status: Status }) => {
  if (status === 'running') {
    return (
      <CircleDashedIcon
        className="size-5 animate-[spin_2s_linear_infinite]"
        aria-hidden
      />
    )
  }
  if (status === 'completed') {
    return (
      <CircleCheckIcon
        className="size-5 text-green-600 dark:text-green-400"
        aria-hidden
      />
    )
  }
  if (status === 'failed') {
    return <CircleXIcon className="text-destructive size-5" aria-hidden />
  }
  if (status === 'skipped') {
    return (
      <CircleSlashIcon className="text-muted-foreground size-5" aria-hidden />
    )
  }
  return (
    <CircleDashedIcon className="text-muted-foreground size-5" aria-hidden />
  )
}

const PipelineSteps = ({
  steps,
  inProgress,
  onStartRun,
}: {
  steps: Snapshot
  inProgress: boolean
  onStartRun: (outcome: Outcome) => void
}) => {
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={inProgress}
          onClick={() => onStartRun('success')}
        >
          Simulate success
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={inProgress}
          onClick={() => onStartRun('error')}
        >
          Simulate error
        </Button>
      </div>
      <ol aria-busy={inProgress} aria-label="Pipeline" className="space-y-1">
        {steps.map((step) => (
          <li key={step.name} className="flex items-center gap-3 py-1.5">
            <StepIcon status={step.status} />
            <span className="text-base">{step.name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export { PipelineSteps }
