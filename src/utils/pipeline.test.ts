import { describe, expect, test } from 'vitest'

import { IDLE_SNAPSHOT, isTerminalSnapshot } from './pipeline'

describe('isTerminalSnapshot', () => {
  test('a Snapshot is Terminal when every Step is completed, failed, or skipped', () => {
    expect(
      isTerminalSnapshot([
        { name: 'Installing dependencies', status: 'completed' },
        { name: 'Linting', status: 'failed' },
        { name: 'Testing', status: 'skipped' },
      ]),
    ).toBe(true)
  })

  test('an empty Snapshot is not Terminal', () => {
    expect(isTerminalSnapshot([])).toBe(false)
  })

  test('a Snapshot is not Terminal while any Step is pending or running', () => {
    expect(
      isTerminalSnapshot([
        { name: 'Installing dependencies', status: 'completed' },
        { name: 'Linting', status: 'running' },
      ]),
    ).toBe(false)
    expect(
      isTerminalSnapshot([
        { name: 'Installing dependencies', status: 'pending' },
      ]),
    ).toBe(false)
  })
})

describe('IDLE_SNAPSHOT', () => {
  test('Idle Snapshot is every Pipeline Step pending', () => {
    expect(IDLE_SNAPSHOT).toEqual([
      { name: 'Cloning', status: 'pending' },
      { name: 'Installing dependencies', status: 'pending' },
      { name: 'Linting', status: 'pending' },
      { name: 'Testing', status: 'pending' },
      { name: 'Building', status: 'pending' },
      { name: 'Deploying', status: 'pending' },
    ])
  })
})
