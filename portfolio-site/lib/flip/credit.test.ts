import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePublicCredit } from './credit.ts'

test('credit is off for legacy requests and non-boolean consent', () => {
  for (const creditOptIn of [undefined, false, 'true', 1]) {
    assert.deepEqual(validatePublicCredit({ creditOptIn, publicName: 'Never publish this' }), { ok: true, creditOptIn: false, publicName: null })
  }
})
test('consented public name is separate, bounded, and normalized', () => {
  assert.deepEqual(validatePublicCredit({ creditOptIn: true, publicName: '  Record   Collector  ' }), { ok: true, creditOptIn: true, publicName: 'Record Collector' })
  for (const publicName of ['', '   ', 'a'.repeat(61), 'bad\u0000name', null]) assert.equal(validatePublicCredit({ creditOptIn: true, publicName }).ok, false)
})

test('request storage retains the explicit credit choice without deriving a name from contact', async () => {
  const { storeFlipRequest } = await import('./store.ts')
  const saved: string[] = []
  const db = { get: async () => null, set: async () => null, rpush: async (_key: string, value: string) => { saved.push(value); return 1 } }
  for (const optIn of [false, true]) {
    const credit = validatePublicCredit({ creditOptIn: optIn, publicName: 'Record Collector' })
    assert.equal(credit.ok, true)
    if (!credit.ok) continue
    await storeFlipRequest({ at: '2026-10-15T12:00:00Z', rid: 1, title: 'Test recording', artist: 'Fixture', year: null, isrc: null, email: 'private@example.com', phone: null, smsOptIn: false, creditOptIn: credit.creditOptIn, publicName: credit.publicName }, db, { VERCEL_ENV: 'preview' })
  }
  assert.equal(JSON.parse(saved[0]).publicName, null)
  assert.equal(JSON.parse(saved[0]).creditOptIn, false)
  assert.equal(JSON.parse(saved[1]).publicName, 'Record Collector')
  assert.equal(JSON.parse(saved[1]).creditOptIn, true)
})
