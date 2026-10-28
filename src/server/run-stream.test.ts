import { describe, expect, test } from 'vitest'

import type { Snapshot } from '@/types/pipeline'
import { runStream } from './run-stream'

const parseSse = (body: string) =>
  body
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event:(.*)$/m)?.[1].trim() ?? ''
      const data = block.match(/^data:(.*)$/m)?.[1].trim() ?? ''
      return { event, data: JSON.parse(data) as Snapshot }
    })

const runRequest = (outcome?: string, init?: RequestInit) => {
  const url = new URL('http://localhost/api/run')
  if (outcome !== undefined) {
    url.searchParams.set('outcome', outcome)
  }
  return new Request(url, init)
}

describe('runStream', () => {
  test('missing outcome returns 400 and starts no Run', async () => {
    let waited = false
    const wait = async () => {
      waited = true
    }

    const response = runStream(runRequest(), wait)
    await response.text()

    expect(response.status).toBe(400)
    expect(waited).toBe(false)
  })

  test('invalid outcome returns 400 and starts no Run', async () => {
    let waited = false
    const wait = async () => {
      waited = true
    }

    const response = runStream(runRequest('nope'), wait)
    await response.text()

    expect(response.status).toBe(400)
    expect(waited).toBe(false)
  })

  test('success Run streams each Step completing then closes', async () => {
    let waits = 0
    const wait = async () => {
      waits += 1
    }

    const response = runStream(runRequest('success'), wait)
    const events = parseSse(await response.text())

    expect(events).toEqual([
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'running' },
          { name: 'Installing dependencies', status: 'pending' },
          { name: 'Linting', status: 'pending' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'running' },
          { name: 'Linting', status: 'pending' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'running' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'running' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'completed' },
          { name: 'Building', status: 'running' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'completed' },
          { name: 'Building', status: 'completed' },
          { name: 'Deploying', status: 'running' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'completed' },
          { name: 'Building', status: 'completed' },
          { name: 'Deploying', status: 'completed' },
        ],
      },
    ])
    expect(waits).toBe(6)
  })

  test('success Run uses wait between Step transitions', async () => {
    let release = () => {}
    let hold = true
    const wait = () => {
      if (!hold) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        release = resolve
      })
    }

    const response = runStream(runRequest('success'), wait)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    const readChunk = async () => {
      const { value, done } = await reader.read()
      if (done) {
        return ''
      }
      return decoder.decode(value)
    }

    const first = parseSse(await readChunk())
    expect(first).toHaveLength(1)
    expect(first[0]?.data[0]).toEqual({
      name: 'Cloning',
      status: 'running',
    })

    let nextChunk = ''
    let arrived = false
    const pending = readChunk().then((chunk) => {
      arrived = true
      nextChunk = chunk
      return chunk
    })

    await Promise.resolve()
    expect(arrived).toBe(false)

    release()
    await pending
    expect(parseSse(nextChunk)[0]?.data.slice(0, 2)).toEqual([
      { name: 'Cloning', status: 'completed' },
      { name: 'Installing dependencies', status: 'running' },
    ])

    hold = false
    release()
    while (true) {
      const { done } = await reader.read()
      if (done) {
        break
      }
    }
  })

  test('success Run first snapshot has Cloning running', async () => {
    const response = runStream(runRequest('success'), async () => {})

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8',
    )

    const events = parseSse(await response.text())
    expect(events[0]).toEqual({
      event: 'run',
      data: [
        { name: 'Cloning', status: 'running' },
        { name: 'Installing dependencies', status: 'pending' },
        { name: 'Linting', status: 'pending' },
        { name: 'Testing', status: 'pending' },
        { name: 'Building', status: 'pending' },
        { name: 'Deploying', status: 'pending' },
      ],
    })
  })

  test('error Run streams Cloning, Installing dependencies and Linting completed, then Testing failed and later Steps skipped in one event', async () => {
    let waits = 0
    const wait = async () => {
      waits += 1
    }

    const response = runStream(runRequest('error'), wait)
    const events = parseSse(await response.text())

    expect(events).toEqual([
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'running' },
          { name: 'Installing dependencies', status: 'pending' },
          { name: 'Linting', status: 'pending' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'running' },
          { name: 'Linting', status: 'pending' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'running' },
          { name: 'Testing', status: 'pending' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'running' },
          { name: 'Building', status: 'pending' },
          { name: 'Deploying', status: 'pending' },
        ],
      },
      {
        event: 'run',
        data: [
          { name: 'Cloning', status: 'completed' },
          { name: 'Installing dependencies', status: 'completed' },
          { name: 'Linting', status: 'completed' },
          { name: 'Testing', status: 'failed' },
          { name: 'Building', status: 'skipped' },
          { name: 'Deploying', status: 'skipped' },
        ],
      },
    ])
    expect(waits).toBe(4)
  })

  test('aborting the request mid-Run stops further run events', async () => {
    const abort = new AbortController()
    const wait = () => new Promise<void>(() => {})

    const response = runStream(
      runRequest('success', { signal: abort.signal }),
      wait,
    )
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    const readChunk = async () => {
      const { value, done } = await reader.read()
      if (done) {
        return ''
      }
      return decoder.decode(value)
    }

    const first = parseSse(await readChunk())
    expect(first).toHaveLength(1)
    expect(first[0]?.data[0]).toEqual({
      name: 'Cloning',
      status: 'running',
    })

    abort.abort()

    const rest: string[] = []
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      rest.push(decoder.decode(value))
    }

    expect(parseSse(rest.join(''))).toEqual([])
  })

  test('a second concurrent GET is an independent Run', async () => {
    let releaseA = () => {}
    let holdA = true
    const waitA = () => {
      if (!holdA) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        releaseA = resolve
      })
    }

    let releaseB = () => {}
    let holdB = true
    const waitB = () => {
      if (!holdB) {
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        releaseB = resolve
      })
    }

    const decoder = new TextDecoder()
    const readChunk = async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
    ) => {
      const { value, done } = await reader.read()
      if (done) {
        return ''
      }
      return decoder.decode(value)
    }

    const readerA = runStream(runRequest('success'), waitA).body!.getReader()
    const readerB = runStream(runRequest('success'), waitB).body!.getReader()

    expect(parseSse(await readChunk(readerA))[0]?.data[0]).toEqual({
      name: 'Cloning',
      status: 'running',
    })
    expect(parseSse(await readChunk(readerB))[0]?.data[0]).toEqual({
      name: 'Cloning',
      status: 'running',
    })

    let bArrived = false
    const pendingB = readChunk(readerB).then((chunk) => {
      bArrived = true
      return chunk
    })

    releaseA()
    expect(parseSse(await readChunk(readerA))[0]?.data.slice(0, 2)).toEqual([
      { name: 'Cloning', status: 'completed' },
      { name: 'Installing dependencies', status: 'running' },
    ])

    await Promise.resolve()
    expect(bArrived).toBe(false)

    releaseB()
    expect(parseSse(await pendingB)[0]?.data.slice(0, 2)).toEqual([
      { name: 'Cloning', status: 'completed' },
      { name: 'Installing dependencies', status: 'running' },
    ])

    holdA = false
    holdB = false
    releaseA()
    releaseB()
    while (true) {
      const { done } = await readerA.read()
      if (done) {
        break
      }
    }
    while (true) {
      const { done } = await readerB.read()
      if (done) {
        break
      }
    }
  })
})
