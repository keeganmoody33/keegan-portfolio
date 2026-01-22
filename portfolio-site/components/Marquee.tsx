'use client'

export default function Marquee() {
  const items = [
    { icon: '🎵', text: 'NOW PLAYING: AUTECHRE - NTS SESSION 1' },
    { icon: '⚙️', text: 'GIT_STATUS :: PUSHES_24H: 14 // PR_OPEN: 2' },
    { icon: '🤖', text: 'ANTHROPIC: CLAUDE OPUS ACTIVE' },
    { icon: '▲', text: 'VERCEL UPTIME: 99.9%' },
    { icon: '📦', text: 'NEW: PORTFOLIO_V2_DEPLOYED' },
  ]

  // Duplicate items for seamless loop
  const allItems = [...items, ...items]

  return (
    <div className="w-full overflow-hidden border-b border-[var(--border-dim)] bg-[var(--bg-surface)]">
      <div className="marquee-container py-2">
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-8 whitespace-nowrap">
            <span>{item.icon}</span>
            <span className="text-[var(--text-muted)] font-mono text-xs">
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
