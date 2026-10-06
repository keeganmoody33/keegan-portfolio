import RecordDetailRoute from '@/components/house/RecordDetailRoute'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ releaseId: string }>
}

export default async function CollectionRecordOverlay({ params }: PageProps) {
  const { releaseId } = await params
  return <RecordDetailRoute rawId={releaseId} mode="overlay" />
}
