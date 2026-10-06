import RecordDetailRoute from '@/components/house/RecordDetailRoute'

export const revalidate = 300

type PageProps = {
  params: Promise<{ releaseId: string }>
}

export default async function CollectionRecordOverlay({ params }: PageProps) {
  const { releaseId } = await params
  return <RecordDetailRoute rawId={releaseId} mode="overlay" />
}
