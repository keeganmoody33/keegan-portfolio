import type { SourcedText, StoredPressing } from './types.ts'
import bootsy from './fixtures/573292.json' with { type: 'json' }
import goodieMob from './fixtures/240128.json' with { type: 'json' }
import mtume from './fixtures/567894.json' with { type: 'json' }

const FIXTURE_DESCRIPTIONS: Record<number, SourcedText> = {}

function asDescription(value: unknown): SourcedText | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { description?: SourcedText | null }
  const description = record.description
  if (!description || typeof description.text !== 'string') return null
  if (description.text.trim().length === 0) return null
  if (description.source !== 'discogs' && description.source !== 'musicbrainz') return null
  if (typeof description.sourceUrl !== 'string' || description.sourceUrl.length === 0) return null
  return description
}

for (const raw of [bootsy, goodieMob, mtume]) {
  const description = asDescription(raw)
  const releaseId =
    raw && typeof raw === 'object' && typeof (raw as { releaseId?: unknown }).releaseId === 'number'
      ? (raw as { releaseId: number }).releaseId
      : 0
  if (description && releaseId > 0) FIXTURE_DESCRIPTIONS[releaseId] = description
}

export function fixtureDescription(releaseId: number): SourcedText | null {
  return FIXTURE_DESCRIPTIONS[releaseId] ?? null
}

export function isUnusableSentence(sentence: string): boolean {
  return /matrix|runout|etched|inscribed|variant \d|catalog number transcript|illegible|manufactured by|distributed by|warner blvd|boulevard|a warner communications|warner bros\.? records inc|subsidiary of|winchester,?\s*va|\bburbank,?\s*ca\b|\b\d{5}(?:-\d{4})?\b/i.test(
    sentence
  )
}

export function isUnusableDiscogsNotes(raw: string | null | undefined): boolean {
  if (!raw) return true
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (cleaned.length < 24) return true
  if (isUnusableSentence(cleaned)) return true
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 12)
  return parts.filter((part) => !isUnusableSentence(part)).length === 0
}

export function sentencesFrom(raw: string | null | undefined, max = 4): string | null {
  if (!raw || isUnusableDiscogsNotes(raw)) return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 12)
  const kept = parts.filter((part) => !isUnusableSentence(part))
  if (kept.length === 0) return null
  return kept.slice(0, max).join(' ')
}

export function resolveDescription(options: {
  notes?: string | null
  url: string
  previous?: SourcedText | null
  releaseId?: number
}): SourcedText | null {
  const fromNotes = sentencesFrom(options.notes)
  if (fromNotes) {
    return { text: fromNotes, source: 'discogs', sourceUrl: options.url }
  }
  if (options.previous?.text && !isUnusableDiscogsNotes(options.previous.text)) {
    return options.previous
  }
  if (options.releaseId) {
    const fixture = fixtureDescription(options.releaseId)
    if (fixture) return fixture
  }
  return null
}

export function withReadableDescription(pressing: StoredPressing): StoredPressing {
  const current = pressing.description?.text ?? null
  if (current && !isUnusableDiscogsNotes(current)) return pressing
  const resolved = resolveDescription({
    notes: current,
    url: pressing.facts.discogsUrl,
    previous: pressing.description,
    releaseId: pressing.releaseId,
  })
  if (!resolved || resolved.text === current) return pressing
  return { ...pressing, description: resolved }
}
