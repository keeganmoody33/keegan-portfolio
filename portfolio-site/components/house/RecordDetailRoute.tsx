import { notFound } from 'next/navigation'
import RecordDetail from '@/components/house/RecordDetail'
import {
  parseReleaseParam,
  readStoredPressingOnce,
  unavailablePressing,
} from '@/lib/crate/read'
import { getDefaultCoverStore } from '@/lib/crate/cover-store'
import { houseMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export async function recordDetailMetadata(rawId: string): Promise<Metadata> {
  const releaseId = parseReleaseParam(rawId)
  if (!releaseId) {
    return { title: 'not found — lecturesfrom' }
  }
  const read = await readStoredPressingOnce(releaseId)
  if (read.status === 'not_found') {
    return { title: 'not found — lecturesfrom' }
  }
  if (read.status === 'unavailable') {
    return houseMetadata(
      `/collection/${releaseId}`,
      'collection — lecturesfrom',
      "couldn't reach discogs"
    )
  }
  const { artist, title } = read.pressing.facts
  const description =
    read.pressing.description?.text || [artist, title].filter(Boolean).join(' — ')
  return houseMetadata(`/collection/${releaseId}`, `${title} — lecturesfrom`, description)
}

export default async function RecordDetailRoute({
  rawId,
  mode,
}: {
  rawId: string
  mode: 'page' | 'overlay'
}) {
  const releaseId = parseReleaseParam(rawId)
  if (!releaseId) notFound()

  const read = await readStoredPressingOnce(releaseId)
  if (read.status === 'not_found') notFound()
  const cover = (await getDefaultCoverStore()?.get(releaseId)) ?? null
  if (read.status === 'unavailable') {
    return (
      <RecordDetail
        pressing={unavailablePressing(releaseId, read.listed)}
        mode={mode}
        unavailable
        cover={cover}
      />
    )
  }

  return (
    <RecordDetail
      pressing={read.pressing}
      mode={mode}
      crateSource={read.from === 'store' ? 'redis' : read.from}
      cover={cover}
    />
  )
}
