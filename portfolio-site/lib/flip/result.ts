import type { FlipLookupResult, FlipSampleRow, FlipSearchResult, FlipSong } from './types.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asRid(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }
  return null
}

function asSampleRow(value: unknown): FlipSampleRow | null {
  const rec = asRecord(value)
  if (!rec) return null
  const title = asString(rec.title)
  if (!title) return null
  return {
    title,
    artist: asString(rec.artist) ?? '',
    year: asString(rec.year),
  }
}

function asSong(value: unknown): FlipSong | null {
  const rec = asRecord(value)
  if (!rec) return null
  const title = asString(rec.title)
  const artist = asString(rec.artist)
  if (!title || !artist) return null
  return {
    rid: asRid(rec.rid),
    title,
    artist,
    year: asString(rec.year),
    isrc: asString(rec.isrc),
  }
}

function asRows(value: unknown): FlipSampleRow[] {
  if (!Array.isArray(value)) return []
  const rows: FlipSampleRow[] = []
  for (const item of value) {
    const row = asSampleRow(item)
    if (row) rows.push(row)
  }
  return rows
}

export function parseLookupResult(value: unknown): FlipLookupResult | null {
  const rec = asRecord(value)
  if (!rec) return null
  const status = rec.status
  if (status !== 'ok' && status !== 'empty' && status !== 'no_match' && status !== 'down') {
    return null
  }
  return {
    status,
    fixture: rec.fixture === true,
    checked: asString(rec.checked),
    song: asSong(rec.song),
    samples: asRows(rec.samples),
    sampledIn: asRows(rec.sampledIn),
  }
}

export function parseSearchResult(value: unknown): FlipSearchResult | null {
  const rec = asRecord(value)
  if (!rec) return null
  const status = rec.status
  if (status !== 'ok' && status !== 'no_match' && status !== 'down') {
    return null
  }
  const hits: FlipSong[] = []
  if (Array.isArray(rec.hits)) {
    for (const item of rec.hits) {
      const song = asSong(item)
      if (song) hits.push(song)
    }
  }
  return {
    status,
    fixture: rec.fixture === true,
    hits,
  }
}

export function artistYearLine(row: FlipSampleRow | FlipSong): string {
  return [row.artist, row.year].filter((part) => part && part.length > 0).join(' · ')
}

/** The pick wins when it has a value. A cached song fills whatever the pick left empty. */
export function fillSongIdentity(
  song: FlipSong,
  picked: Pick<FlipSong, 'rid' | 'year' | 'isrc'>
): FlipSong {
  return {
    ...song,
    rid: picked.rid ?? song.rid,
    year: picked.year ?? song.year,
    isrc: picked.isrc ?? song.isrc,
  }
}
