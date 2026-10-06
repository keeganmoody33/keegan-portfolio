const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--house-ink)]'

export default function DiscogsCredit({ href }: { href: string }) {
  return (
    <p className="house-credit mt-2">
      <a
        href={href}
        className={`inline-flex min-h-6 items-center hover:text-[var(--house-orange)] ${focusRing}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Data provided by Discogs.
      </a>
    </p>
  )
}
