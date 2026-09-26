export default function HouseRail({
  left = 'atl 33.70n',
  center = 'issue 01',
  right = '2026',
}: {
  left?: string
  center?: string
  right?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-6 pt-6 sm:px-10">
      <span className="house-meta">{left}</span>
      <span className="house-meta hidden sm:inline">{center}</span>
      <span className="house-meta">{right}</span>
    </div>
  )
}
