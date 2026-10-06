import {
  WIKIDATA_MIN_INTERVAL_MS,
  WIKIDATA_SPARQL_URL,
  WIKIDATA_USER_AGENT,
  type ResearchFact,
} from './types.ts'

export type WikidataFetch = (input: string, init?: RequestInit) => Promise<Response>

export type WikidataClientOptions = {
  fetchImpl?: WikidataFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
}

const CREDIT_PROPS: Record<string, string> = {
  P175: 'performer',
  P86: 'composer',
  P676: 'lyricist',
  P162: 'producer',
  P87: 'librettist',
}

const SAMPLE_PROPS: Record<string, 'sample_of' | 'sampled_by'> = {
  P736: 'sample_of',
  P144: 'sample_of',
  P4969: 'sampled_by',
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

export function wikidataEntityUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`
}

export function wikidataReleaseQuery(discogsReleaseId: number): string {
  const id = String(discogsReleaseId)
  return `SELECT ?item ?itemLabel ?prop ?value ?valueLabel WHERE {
  ?item wdt:P2206 "${id}" .
  VALUES ?prop { wd:P175 wd:P86 wd:P676 wd:P162 wd:P87 wd:P736 wd:P144 wd:P4969 }
  {
    ?item ?wdt ?value .
    ?prop wikibase:directClaim ?wdt .
  } UNION {
    ?value wdt:P4969 ?item .
    BIND(wd:P4969 AS ?prop)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`
}

export function researchFactsFromWikidataBindings(
  bindings: SparqlBinding[],
  discogsReleaseId: number,
  fetchedAt: string
): ResearchFact[] {
  const facts: ResearchFact[] = []
  const seen = new Set<string>()
  for (const row of bindings) {
    const itemQid = entityIdFromUri(row.item?.value)
    const valueQid = entityIdFromUri(row.value?.value)
    const prop = propIdFromUri(row.prop?.value)
    const valueLabel = row.valueLabel?.value?.trim() ?? ''
    const itemLabel = row.itemLabel?.value?.trim() ?? ''
    if (!itemQid || !prop) continue
    const creditRole = CREDIT_PROPS[prop]
    const sampleKind = SAMPLE_PROPS[prop]
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
        sourceUrl: wikidataEntityUrl(valueQid || itemQid),
        fetchedAt,
      }
    } else if (sampleKind && (valueLabel || itemLabel)) {
      const relatedTitle = sampleKind === 'sampled_by' ? valueLabel || itemLabel : valueLabel
      fact = {
        kind: sampleKind,
        trackKey: '',
        track: null,
        role: prop === 'P736' ? 'cover of' : prop === 'P144' ? 'based on' : 'derivative work',
        person: '',
        relatedTitle,
        relatedArtist: '',
        source: 'wikidata',
        sourceId: valueQid || itemQid,
        sourceUrl: wikidataEntityUrl(valueQid || itemQid),
        fetchedAt,
      }
    }
    if (!fact) continue
    const key = `${fact.kind}:${fact.role}:${fact.person}:${fact.relatedTitle}`
    if (seen.has(key)) continue
    seen.add(key)
    facts.push(fact)
  }
  void discogsReleaseId
  return facts
}

export function createWikidataClient(options: WikidataClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const minInterval = options.minIntervalMs ?? WIKIDATA_MIN_INTERVAL_MS
  let lastAt = 0
  let requestCount = 0

  return {
    get requestCount() {
      return requestCount
    },
    async lookupDiscogsRelease(
      discogsReleaseId: number,
      fetchedAt: string
    ): Promise<ResearchFact[]> {
      const wait = lastAt + minInterval - now()
      if (wait > 0) await sleep(wait)
      lastAt = now()
      requestCount += 1
      const body = new URLSearchParams({
        query: wikidataReleaseQuery(discogsReleaseId),
        format: 'json',
      })
      const response = await fetchImpl(WIKIDATA_SPARQL_URL, {
        method: 'POST',
        headers: {
          'User-Agent': WIKIDATA_USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      if (!response.ok) return []
      let data: SparqlResponse
      try {
        data = (await response.json()) as SparqlResponse
      } catch {
        return []
      }
      return researchFactsFromWikidataBindings(
        data.results?.bindings ?? [],
        discogsReleaseId,
        fetchedAt
      )
    },
  }
}

export type WikidataClient = ReturnType<typeof createWikidataClient>

export async function lookupWikidataReleaseFacts(
  discogsReleaseId: number,
  fetchedAt: string,
  options: WikidataClientOptions = {}
): Promise<ResearchFact[]> {
  return createWikidataClient(options).lookupDiscogsRelease(discogsReleaseId, fetchedAt)
}
