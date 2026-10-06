import RecordDetailRoute, {
  recordDetailMetadata,
} from '@/components/house/RecordDetailRoute'
import { CRATE_FIXTURE_IDS } from '@/lib/crate/read'
import type { Metadata } from 'next'

export const revalidate = 300
export const dynamicParams = true

type PageProps = {
  params: Promise<{ releaseId: string }>
}

export function generateStaticParams() {
  return CRATE_FIXTURE_IDS.map((releaseId) => ({ releaseId: String(releaseId) }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { releaseId } = await params
  return recordDetailMetadata(releaseId)
}

export default async function CollectionRecordPage({ params }: PageProps) {
  const { releaseId } = await params
  return <RecordDetailRoute rawId={releaseId} mode="page" />
}
