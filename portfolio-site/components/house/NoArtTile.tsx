export default function NoArtTile({
  artist,
  title,
}: {
  artist: string
  title: string
}) {
  return (
    <div
      className="flex aspect-square w-full flex-col justify-end border border-[var(--house-line)] bg-[var(--house-bg)] p-3"
      aria-hidden
    >
      <p className="house-meta truncate">{artist}</p>
      <p className="house-meta mt-1 truncate text-[var(--house-dim)]">{title}</p>
    </div>
  )
}
