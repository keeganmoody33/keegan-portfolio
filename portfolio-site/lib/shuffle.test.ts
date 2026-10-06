/**
 * Collection crate shuffle — permutation, no lost or duplicated ids.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/shuffle.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listedReleaseIds, pickListedId, shuffledCopy } from './shuffle.ts'

function scriptedRng(values: number[]): () => number {
  let i = 0
  return () => {
    const value = values[i]
    i += 1
    if (value === undefined) {
      throw new Error(`rng called ${i} times; only ${values.length} values scripted`)
    }
    return value
  }
}

function sorted(ids: readonly number[]): number[] {
  return ids.slice().sort((a, b) => a - b)
}

describe('shuffledCopy (Fisher-Yates)', () => {
  it('is a permutation: same ids, no losses, no extras', () => {
    const ids = [573292, 240128, 567894, 573292, 8, 13]
    const items = ids.map((releaseId, index) => ({
      releaseId,
      instanceId: index + 1,
    }))
    const out = shuffledCopy(items, scriptedRng([0.9, 0.1, 0.55, 0, 0.72]))

    assert.equal(out.length, items.length)
    assert.deepEqual(
      sorted(out.map((item) => item.instanceId)),
      sorted(items.map((item) => item.instanceId))
    )
    assert.deepEqual(
      sorted(out.map((item) => item.releaseId)),
      sorted(ids)
    )
    assert.equal(new Set(out.map((item) => item.instanceId)).size, items.length)
  })

  it('does not mutate the input list', () => {
    const items = [1, 2, 3, 4, 5]
    const snapshot = items.slice()
    shuffledCopy(items, () => 0)
    assert.deepEqual(items, snapshot)
  })

  it('reorders when the rng is not identity', () => {
    const items = [1, 2, 3, 4, 5]
    const out = shuffledCopy(items, () => 0)
    assert.deepEqual(out, [2, 3, 4, 5, 1])
    assert.notDeepEqual(out, items)
  })

  it('returns a new empty array for an empty input', () => {
    const items: number[] = []
    const out = shuffledCopy(items)
    assert.deepEqual(out, [])
    assert.notEqual(out, items)
  })

  it('returns a copy of a single-element list', () => {
    const items = [99]
    const out = shuffledCopy(items, () => 0.5)
    assert.deepEqual(out, [99])
    assert.notEqual(out, items)
  })

  it('each call with a new rng produces an independent permutation', () => {
    const items = [1, 2, 3, 4]
    const first = shuffledCopy(items, () => 0)
    const second = shuffledCopy(items, () => 0.99)
    assert.deepEqual(first, [2, 3, 4, 1])
    assert.deepEqual(second, [1, 2, 3, 4])
  })
})

describe('listedReleaseIds / pickListedId', () => {
  it('keeps every listed id, including duplicates, and drops zeros', () => {
    assert.deepEqual(
      listedReleaseIds([
        { releaseId: 0 },
        { releaseId: 10 },
        { releaseId: 10 },
        { releaseId: -1 },
        { releaseId: 7 },
      ]),
      [10, 10, 7]
    )
  })

  it('picks from listed ids (duplicates more likely)', () => {
    const releases = [{ releaseId: 0 }, { releaseId: 10 }, { releaseId: 10 }, { releaseId: 7 }]
    assert.equal(pickListedId(releases, () => 0), 10)
    assert.equal(pickListedId(releases, () => 0.5), 10)
    assert.equal(pickListedId(releases, () => 0.9), 7)
  })

  it('returns null when nothing is listed', () => {
    assert.equal(pickListedId([]), null)
    assert.equal(pickListedId([{ releaseId: 0 }]), null)
  })
})
