import { readRetryAfterMs } from './musicbrainz.ts'
import {
  WIKIDATA_MIN_INTERVAL_MS,
  WIKIDATA_RETRY_AFTER_CAP_MS,
  WIKIDATA_SPARQL_URL,
  WIKIDATA_TIMEOUT_MS,
  WIKIDATA_USER_AGENT,
  type ResearchFact,
} from './types.ts'

export type WikidataFetch = (input: string, init?: RequestInit) => Promise<Response>

export type WikidataClientOptions = {
  fetchImpl?: WikidataFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
  timeoutMs?: number
}

export type WikidataLookupInput = {
  discogsReleaseId: number
  masterId?: number | null
  mbReleaseId?: string | null
  mbReleaseGroupId?: string | null
}

export type WikidataLookupOptions = {
  deadlineMs?: number
}

export type WikidataMatchProp = 'P1954' | 'P436' | 'P2206' | 'P5813'

export type WikidataIdentity = {
  status: 'ok' | 'empty' | 'ambiguous'
  itemQid: string | null
  matchProp: WikidataMatchProp | null
  itemQids: string[]
}

export type WikidataLookupResult =
  | { status: 'ok'; facts: ResearchFact[]; identity: WikidataIdentity }
  | { status: 'empty'; facts: ResearchFact[]; identity: WikidataIdentity }
  | { status: 'ambiguous'; facts: ResearchFact[]; identity: WikidataIdentity }
  | { status: 'temporary'; error: WikidataTemporaryError }

const CREDIT_PROPS: Record<string, string> = {
  P175: 'performer',
  P86: 'composer',
  P676: 'lyricist',
  P162: 'producer',
  P87: 'librettist',
}

const MATCH_RANK: Record<string, number> = {
  P1954: 0,
  P436: 1,
  P2206: 2,
  P5813: 2,
}

type SparqlBinding = Record<string, { type?: string; value?: string }>

type SparqlResponse = {
  results?: { bindings?: SparqlBinding[] }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function entityIdFromUri(value: string | undefined): string {
  if (!value) return ''
  const match = value.match(/\/(entity|wiki)\/(Q\d+)$/i) ?? value.match(/(Q\d+)$/i)
  return match?.[2] ?? match?.[1] ?? value
}

function propIdFromUri(value: string | undefined): string {
  if (!value) return ''
  const match = value.match(/\/entity\/(P\d+)$/i) ?? value.match(/(P\d+)$/i)
  return match?.[1] ?? value
}

function sparqlEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function abortableSleep(
  sleep: (ms: number) => Promise<void>,
  ms: number,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return
  let onAbort: (() => void) | null = null
  const aborted = new Promise<void>((resolve) => {
    onAbort = () => resolve()
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    await Promise.race([sleep(ms), aborted])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

export function wikidataEntityUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`
}

export class WikidataTemporaryError extends Error {
  readonly kind: 'unavailable' | 'rate_limit'
  readonly temporary = true as const
  readonly status: number | 'timeout'
  readonly retryAfterMs: number | null

  constructor(status: number | 'timeout', retryAfterMs: number | null = null, message?: string) {
    super(
      message ??
        (status === 'timeout'
          ? 'Wikidata timed out'
          : status === 429
            ? 'Wikidata rate limited'
            : 'Wikidata unavailable')
    )
    this.name = 'WikidataTemporaryError'
    this.status = status
    this.retryAfterMs = retryAfterMs
    this.kind = status === 429 ? 'rate_limit' : 'unavailable'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function isWikidataTemporaryError(error: unknown): error is WikidataTemporaryError {
  if (error instanceof WikidataTemporaryError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: unknown; temporary?: unknown; kind?: unknown }
  return (
    candidate.name === 'WikidataTemporaryError' &&
    candidate.temporary === true &&
    (candidate.kind === 'rate_limit' || candidate.kind === 'unavailable')
  )
}

export function isTemporaryWikidataStatus(status: number | 'timeout'): boolean {
  if (status === 'timeout') return true
  return status === 408 || status === 429 || status >= 500
}

export function wikidataReleaseQuery(input: WikidataLookupInput | number): string {
  const lookup: WikidataLookupInput =
    typeof input === 'number' ? { discogsReleaseId: input } : input
  const pairs: string[] = []
  if (lookup.masterId && lookup.masterId > 0) {
    pairs.push(`(wd:P1954 "${sparqlEscape(String(lookup.masterId))}")`)
  }
  if (lookup.mbReleaseGroupId?.trim()) {
    pairs.push(`(wd:P436 "${sparqlEscape(lookup.mbReleaseGroupId.trim())}")`)
  }
  pairs.push(`(wd:P2206 "${sparqlEscape(String(lookup.discogsReleaseId))}")`)
  if (lookup.mbReleaseId?.trim()) {
    pairs.push(`(wd:P5813 "${sparqlEscape(lookup.mbReleaseId.trim())}")`)
  }
  return `SELECT ?item ?itemLabel ?matchProp ?prop ?value ?valueLabel ?direction WHERE {
  VALUES (?matchKey ?matchValue) { ${pairs.join(' ')} }
  ?item ?matchWdt ?matchValue .
  ?matchKey wikibase:directClaim ?matchWdt .
  BIND(?matchKey AS ?matchProp)
  OPTIONAL {
    {
      VALUES ?prop { wd:P175 wd:P86 wd:P676 wd:P162 wd:P87 }
      ?item ?creditWdt ?value .
      ?prop wikibase:directClaim ?creditWdt .
      BIND("out" AS ?direction)
    } UNION {
      ?item wdt:P5707 ?value .
      BIND(wd:P5707 AS ?prop)
      BIND("out" AS ?direction)
    } UNION {
      ?value wdt:P5707 ?item .
      BIND(wd:P5707 AS ?prop)
      BIND("in" AS ?direction)
    }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`
}

export function pickWikidataIdentity(bindings: SparqlBinding[]): WikidataIdentity {
  const empty: WikidataIdentity = {
    status: 'empty',
    itemQid: null,
    matchProp: null,
    itemQids: [],
  }
  const byRank = new Map<number, { prop: string; items: Set<string> }>()
  for (const row of bindings) {
    const itemQid = entityIdFromUri(row.item?.value)
    const matchProp = propIdFromUri(row.matchProp?.value)
    if (!itemQid || !matchProp) continue
    const rank = MATCH_RANK[matchProp]
    if (rank == null) continue
    const bucket = byRank.get(rank) ?? { prop: matchProp, items: new Set<string>() }
    bucket.items.add(itemQid)
    if (MATCH_RANK[bucket.prop] !== rank) bucket.prop = matchProp
    byRank.set(rank, bucket)
  }
  const ranks = [...byRank.keys()].sort((left, right) => left - right)
  const winner = ranks[0] != null ? byRank.get(ranks[0]) : undefined
  if (!winner || winner.items.size === 0) return empty
  const itemQids = [...winner.items]
  const matchProp = winner.prop as WikidataMatchProp
  if (itemQids.length > 1) {
    return { status: 'ambiguous', itemQid: null, matchProp, itemQids }
  }
  const itemQid = itemQids[0]
  if (!itemQid) return empty
  return { status: 'ok', itemQid, matchProp, itemQids }
}

export function researchFactsFromWikidataBindings(
  bindings: SparqlBinding[],
  discogsReleaseId: number,
  fetchedAt: string,
  selectedItemQid?: string | null
): ResearchFact[] {
  const identity = selectedItemQid
    ? { status: 'ok' as const, itemQid: selectedItemQid, matchProp: null, itemQids: [selectedItemQid] }
    : pickWikidataIdentity(bindings)
  if (identity.status !== 'ok' || !identity.itemQid) return []
  const itemQid = identity.itemQid
  const facts: ResearchFact[] = []
  const seen = new Set<string>()
  for (const row of bindings) {
    if (entityIdFromUri(row.item?.value) !== itemQid) continue
    const valueQid = entityIdFromUri(row.value?.value)
    const prop = propIdFromUri(row.prop?.value)
    const valueLabel = row.valueLabel?.value?.trim() ?? ''
    const direction = (row.direction?.value ?? 'out').toLowerCase()
    if (!prop) continue
    const creditRole = CREDIT_PROPS[prop]
    let fact: ResearchFact | null = null
    if (creditRole && valueLabel) {
      fact = {
        kind: 'credit',
        trackKey: '',
        track: null,
        role: creditRole,
        person: valueLabel,
        relatedTitle: '',
        relatedArtist: '',
        source: 'wikidata',
        sourceId: valueQid || valueLabel,
        sourceUrl: wikidataEntityUrl(itemQid),
        fetchedAt,
      }
    } else if (prop === 'P5707' && valueLabel) {
      const sampledBy = direction === 'in'
      fact = {
        kind: sampledBy ? 'sampled_by' : 'sample_of',
        trackKey: '',
        track: null,
        role: sampledBy ? 'sampled in' : 'samples',
        person: '',
        relatedTitle: valueLabel,
        relatedArtist: '',
        source: 'wikidata',
        sourceId: valueQid || valueLabel,
        sourceUrl: wikidataEntityUrl(sampledBy ? valueQid || itemQid : itemQid),
        fetchedAt,
      }
    }
    if (!fact) continue
    const key = `${fact.kind}:${fact.role}:${fact.person}:${fact.relatedTitle}:${fact.sourceUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    facts.push(fact)
  }
  void discogsReleaseId
  return facts
}

function lookupResultFromBindings(
  bindings: SparqlBinding[],
  discogsReleaseId: number,
  fetchedAt: string
): Exclude<WikidataLookupResult, { status: 'temporary' }> {
  const identity = pickWikidataIdentity(bindings)
  if (identity.status === 'ambiguous') {
    return { status: 'ambiguous', facts: [], identity }
  }
  if (identity.status === 'empty' || !identity.itemQid) {
    return { status: 'empty', facts: [], identity }
  }
  const facts = researchFactsFromWikidataBindings(
    bindings,
    discogsReleaseId,
    fetchedAt,
    identity.itemQid
  )
  return { status: 'ok', facts, identity }
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

function abortError(): Error {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

async function jsonWithAbort<T>(response: Response, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError()
  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(response.json() as Promise<T>).then(
      (data) => {
        signal.removeEventListener('abort', onAbort)
        resolve(data)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

export function createWikidataClient(options: WikidataClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const minInterval = options.minIntervalMs ?? WIKIDATA_MIN_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? WIKIDATA_TIMEOUT_MS
  let lastAt = 0
  let requestCount = 0

  async function waitForSlot(): Promise<void> {
    const wait = lastAt + minInterval - now()
    if (wait > 0) await sleep(wait)
    lastAt = now()
    requestCount += 1
  }

  async function postSparql(query: string, signal: AbortSignal): Promise<Response> {
    await waitForSlot()
    const body = new URLSearchParams({
      query,
      format: 'json',
    })
    return fetchImpl(WIKIDATA_SPARQL_URL, {
      method: 'POST',
      headers: {
        'User-Agent': WIKIDATA_USER_AGENT,
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal,
    })
  }

  return {
    get requestCount() {
      return requestCount
    },
    async lookupRelease(
      input: WikidataLookupInput,
      fetchedAt: string,
      lookupOptions: WikidataLookupOptions = {}
    ): Promise<WikidataLookupResult> {
      const query = wikidataReleaseQuery(input)
      const remainingMs = (): number =>
        lookupOptions.deadlineMs == null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, lookupOptions.deadlineMs - now())

      let attemptTimer: ReturnType<typeof setTimeout> | null = null
      let attemptAborted = false
      let attemptSignal: AbortSignal | undefined
      const clearAttempt = () => {
        if (attemptTimer) clearTimeout(attemptTimer)
        attemptTimer = null
      }
      const beginAttempt = (): AbortSignal => {
        clearAttempt()
        attemptAborted = false
        const budget = Math.min(timeoutMs, remainingMs())
        if (!Number.isFinite(budget) || budget <= 0) {
          throw new WikidataTemporaryError('timeout')
        }
        const controller = new AbortController()
        attemptSignal = controller.signal
        attemptTimer = setTimeout(() => {
          attemptAborted = true
          controller.abort()
        }, budget)
        return controller.signal
      }
      const fetchSparql = async (): Promise<Response> => {
        const signal = beginAttempt()
        try {
          return await postSparql(query, signal)
        } catch (error) {
          if (isAbortError(error) || signal.aborted) {
            throw new WikidataTemporaryError('timeout')
          }
          throw new WikidataTemporaryError(503)
        }
      }

      try {
        const startedAt = now()
        let response = await fetchSparql()
        if (response.status === 429) {
          const retryAfterMs = Math.min(
            readRetryAfterMs(response),
            WIKIDATA_RETRY_AFTER_CAP_MS
          )
          clearAttempt()
          if (retryAfterMs > remainingMs()) {
            throw new WikidataTemporaryError(429, retryAfterMs)
          }
          // Sleep sits outside the SPARQL timer. A Retry-After longer than
          // what's left of this request's timeout still surfaces as a
          // temporary 429 right away instead of holding the worker.
          const requestRemainingMs = Math.min(timeoutMs - (now() - startedAt), remainingMs())
          if (retryAfterMs >= requestRemainingMs) {
            throw new WikidataTemporaryError(429, retryAfterMs)
          }
          if (retryAfterMs > 0) {
            const retryController = new AbortController()
            const retryTimer = setTimeout(() => retryController.abort(), requestRemainingMs)
            try {
              await abortableSleep(sleep, retryAfterMs, retryController.signal)
              if (retryController.signal.aborted) {
                throw new WikidataTemporaryError('timeout', retryAfterMs)
              }
            } finally {
              clearTimeout(retryTimer)
            }
            try {
              response = await fetchSparql()
            } catch (error) {
              if (isAbortError(error)) {
                throw new WikidataTemporaryError('timeout', retryAfterMs)
              }
              if (isWikidataTemporaryError(error) && (error.status === 'timeout' || error.status === 503)) {
                throw new WikidataTemporaryError(error.status, retryAfterMs)
              }
              throw error
            }
          }
          if (response.status === 429) {
            clearAttempt()
            throw new WikidataTemporaryError(429, retryAfterMs)
          }
        }
        if (isTemporaryWikidataStatus(response.status)) {
          clearAttempt()
          throw new WikidataTemporaryError(
            response.status,
            response.status === 429 ? readRetryAfterMs(response) : null
          )
        }
        if (!response.ok) {
          clearAttempt()
          return {
            status: 'empty',
            facts: [],
            identity: { status: 'empty', itemQid: null, matchProp: null, itemQids: [] },
          }
        }
        let data: SparqlResponse
        const parseSignal = attemptSignal
        try {
          data = parseSignal
            ? await jsonWithAbort<SparqlResponse>(response, parseSignal)
            : ((await response.json()) as SparqlResponse)
        } catch (error) {
          if (isAbortError(error) || attemptAborted) {
            throw new WikidataTemporaryError('timeout')
          }
          throw new WikidataTemporaryError(503)
        } finally {
          clearAttempt()
        }
        return lookupResultFromBindings(
          data.results?.bindings ?? [],
          input.discogsReleaseId,
          fetchedAt
        )
      } catch (error) {
        if (isWikidataTemporaryError(error)) {
          return { status: 'temporary', error }
        }
        if (isAbortError(error)) {
          return { status: 'temporary', error: new WikidataTemporaryError('timeout') }
        }
        throw error
      } finally {
        clearAttempt()
      }
    },
    async lookupDiscogsRelease(
      discogsReleaseId: number,
      fetchedAt: string
    ): Promise<ResearchFact[]> {
      const result = await this.lookupRelease({ discogsReleaseId }, fetchedAt)
      if (result.status === 'temporary') throw result.error
      return result.facts
    },
  }
}

export type WikidataClient = ReturnType<typeof createWikidataClient>

let sharedWikidataClient: WikidataClient | null = null

export function getSharedWikidataClient(): WikidataClient {
  if (!sharedWikidataClient) sharedWikidataClient = createWikidataClient()
  return sharedWikidataClient
}

export function resetSharedWikidataClient(options?: WikidataClientOptions): void {
  sharedWikidataClient = options === undefined ? null : createWikidataClient(options)
}

export function wikidataClientFor(options?: WikidataClientOptions): WikidataClient {
  if (
    options &&
    (options.fetchImpl ||
      options.now ||
      options.sleep ||
      options.minIntervalMs != null ||
      options.timeoutMs != null)
  ) {
    return createWikidataClient(options)
  }
  return getSharedWikidataClient()
}

export async function lookupWikidataReleaseFacts(
  input: WikidataLookupInput | number,
  fetchedAt: string,
  options: WikidataLookupOptions = {}
): Promise<WikidataLookupResult> {
  const lookup: WikidataLookupInput =
    typeof input === 'number' ? { discogsReleaseId: input } : input
  return getSharedWikidataClient().lookupRelease(lookup, fetchedAt, options)
}
