interface SprayTextProps {
  text: string
  className?: string
  delay?: number
}

export default function SprayText({ text, className = '', delay = 0 }: SprayTextProps) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="spray-char"
          style={{ animationDelay: `${delay + i * 50}ms` }}
        >
          {char}
        </span>
      ))}
      </span>
    </span>
  )
}
