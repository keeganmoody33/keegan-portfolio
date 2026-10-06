const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

export default function DiscogsCredit({
  href,
  inline = false,
}: {
  href: string
  inline?: boolean
}) {
  const link = (
    <a
      href={href}
      className={`house-credit inline-flex min-h-6 items-center hover:text-[var(--house-orange)] ${focusRing}`}
      rel="noopener noreferrer"
      target="_blank"
    >
      Data provided by Discogs.
    </a>
  )
  if (inline) return link
  return <p className="mt-2">{link}</p>
}
