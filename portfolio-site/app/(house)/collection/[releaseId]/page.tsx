import RecordDetailRoute, {
  recordDetailMetadata,
} from '@/components/house/RecordDetailRoute'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ releaseId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { releaseId } = await params
  return recordDetailMetadata(releaseId)
}

export default async function CollectionRecordPage({ params }: PageProps) {
  const { releaseId } = await params
  return <RecordDetailRoute rawId={releaseId} mode="page" />
}
