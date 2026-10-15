import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withCurrentWebsiteContext } from './chat-context.ts'

test('current-build questions receive public product facts and development boundaries', () => {
  const context = withCurrentWebsiteContext('What are you building right now?')
  assert.match(context, /transcribes vocals inside your daw/)
  assert.match(context, /local transcription/)
  assert.match(context, /"title": "proper-respect"/)
  assert.match(context, /hardware is still in development/)
  assert.match(context, /Do not infer that any project has shipped/)
  assert.doesNotMatch(context, /private_context|honest_notes|api_key/i)
})

test('the visitor question remains separate from the server-supplied facts', () => {
  const question = 'Can you explain "punch2pen"?\nWhat does it do?'
  const context = withCurrentWebsiteContext(question)
  assert.equal(JSON.parse(context.split('Visitor question (JSON string): ')[1]), question)
})
