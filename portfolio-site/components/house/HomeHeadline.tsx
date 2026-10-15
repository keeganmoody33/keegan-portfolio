'use client'

import { useEffect, useRef, useState } from 'react'
import editorial from './editorial.module.css'
import styles from './home-headline.module.css'

export default function HomeHeadline() {
  const root = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const element = root.current
    if (!element) return
    let inView = false
    const update = () => setVisible(inView && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      setReady(true)
      update()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return (
    <div ref={root} className={styles.headline} data-ready={ready} data-playing={visible && !paused}>
      <h1 id="home-title" className={editorial.title}>
        <span className="sr-only">i help products, ideas, and teams find their momentum.</span>
        <span aria-hidden="true">i help{' '}
          <span className={styles.words}>
            {['products', 'ideas', 'teams'].map(word => <span key={word} className={styles.word}>{word}</span>)}
          </span>
          <br />find their momentum.
        </span>
      </h1>
      <button type="button" className={styles.control} onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play headline animation' : 'Pause headline animation'}>
        {paused ? 'play words' : 'pause words'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
      </button>
    </div>
  )
}
