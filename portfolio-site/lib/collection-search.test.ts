import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterCollection } from './collection-search.ts'

const records = [
  { artist: 'Beyoncé', title: 'Lemonade', year: 2016, label: 'Columbia', catno: 'ABC-123' },
  { artist: 'Miles Davis', title: 'Kind of Blue', year: 1959, label: 'Columbia', catno: 'CL-1355' },
  { artist: 'Unknown', title: 'Untitled', year: 0, label: '', catno: '' },
]

describe('collection search', () => {
  it('matches case and accents across artist, title, year, label, and catalog number', () => {
    assert.deepEqual(filterCollection(records, ' BEYONCE 2016 '), [records[0]])
    assert.deepEqual(filterCollection(records, 'blue Columbia'), [records[1]])
    assert.deepEqual(filterCollection(records, 'CL-1355'), [records[1]])
    assert.deepEqual(filterCollection(records, 'columbia'), records.slice(0, 2))
  })
  it('requires all search terms and never mutates the collection order', () => {
    assert.deepEqual(filterCollection(records, 'miles lemonade'), [])
    assert.equal(filterCollection(records, '  '), records)
    assert.equal(records[0].title, 'Lemonade')
    assert.deepEqual(filterCollection([records[2]], '0'), [])
  })
})
