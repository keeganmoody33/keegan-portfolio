import type { Sleeve } from '@/lib/catalog'

function Schematic({ format }: { format: Sleeve['format'] }) {
  if (format === 'physical') {
    return (
      <g>
        <rect x="28" y="36" width="64" height="48" rx="4" />
        <circle cx="60" cy="60" r="12" />
        <rect x="78" y="44" width="8" height="6" />
      </g>
    )
  }
  if (format === 'crate') {
    return (
      <g>
        <circle cx="60" cy="60" r="28" />
        <circle cx="60" cy="60" r="8" />
      </g>
    )
  }
  return (
    <g>
      <rect x="24" y="32" width="72" height="56" />
      <line x1="24" y1="44" x2="96" y2="44" />
      <line x1="36" y1="56" x2="84" y2="56" />
      <line x1="36" y1="66" x2="72" y2="66" />
    </g>
  )
}

export default function IssuePlate({ sleeve }: { sleeve: Sleeve }) {
  return (
    <div
      className="aspect-square w-full border border-[var(--house-line)] bg-[var(--house-bg)] p-4"
      aria-hidden
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img">
        <title>{`${sleeve.catno} issue plate`}</title>
        <rect x="1" y="1" width="118" height="118" fill="#0a0a0a" stroke="#E23D00" strokeWidth="0.6" />
        <text
          x="8"
          y="16"
          fill="#E23D00"
          fontFamily="Roboto Mono, monospace"
          fontSize="7"
          letterSpacing="1.4"
        >
          {sleeve.catno}
        </text>
        <text
          x="8"
          y="26"
          fill="#8a8a8a"
          fontFamily="Roboto Mono, monospace"
          fontSize="5"
          letterSpacing="1.6"
        >
          {sleeve.format} {sleeve.year}
        </text>
        <g fill="none" stroke="#E23D00" strokeWidth="0.8">
          <Schematic format={sleeve.format} />
        </g>
      </svg>
    </div>
  )
}
