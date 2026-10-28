'use client'

import { useState } from 'react'

import { SseEventSource } from '@/components/sse-event-source'
import { SseFetch } from '@/components/sse-fetch'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type Strategy = 'event-source' | 'fetch'

const SseDemo = () => {
  const [strategy, setStrategy] = useState<Strategy>('event-source')
  const [inProgress, setInProgress] = useState(false)

  return (
    <div className="flex flex-col gap-10">
      <p className="text-muted-foreground [&>a:hover]:text-primary max-w-xl text-sm leading-normal [&>a]:underline [&>a]:underline-offset-4">
        This is a companion demo for the{' '}
        <a
          href="https://rbika.com/blog/working-with-server-sent-events"
          target="_blank"
          rel="noopener noreferrer"
        >
          Working with Server-Sent Events
        </a>{' '}
        blog post.
        <br />
        View the{' '}
        <a
          href="https://github.com/rbika/sse-demo"
          target="_blank"
          rel="noopener noreferrer"
        >
          source code
        </a>
        .
      </p>
      <FieldSet className="max-w-xl">
        <FieldLegend>Consuming SSE Strategy</FieldLegend>
        <FieldDescription>
          The server stream is the same. Only the frontend strategy changes.
        </FieldDescription>
        <RadioGroup
          className="data-disabled:pointer-events-none"
          value={strategy}
          onValueChange={(value) => {
            if (inProgress) {
              return
            }
            if (value === 'event-source' || value === 'fetch') {
              setStrategy(value)
            }
          }}
          disabled={inProgress}
        >
          <Field orientation="horizontal">
            <RadioGroupItem value="event-source" id="strategy-event-source" />
            <FieldContent>
              <FieldLabel htmlFor="strategy-event-source">
                EventSource
              </FieldLabel>
            </FieldContent>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem value="fetch" id="strategy-fetch" />
            <FieldContent>
              <FieldLabel htmlFor="strategy-fetch">Fetch</FieldLabel>
            </FieldContent>
          </Field>
        </RadioGroup>
      </FieldSet>
      {strategy === 'event-source' ? (
        <SseEventSource onInProgressChange={setInProgress} />
      ) : (
        <SseFetch onInProgressChange={setInProgress} />
      )}
    </div>
  )
}

export { SseDemo }
