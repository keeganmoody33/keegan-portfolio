'use client'

import { useEffect, useState } from 'react'

interface SprayTextProps {
  text: string
  className?: string
  delay?: number
}

export default function SprayText({ text, className = '', delay = 0 }: SprayTextProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  if (!visible) {
    return <span className={`opacity-0 ${className}`}>{text}</span>
  }

  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="spray-char"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}
