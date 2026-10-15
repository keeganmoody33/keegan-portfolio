'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { LOGO_PRESETS, LOGO_BACKGROUNDS, type LogoPreset, type LogoBackground } from './logo-presets'
import styles from './logo-motion.module.css'

const LogoShaderCanvas = dynamic(() => import('./LogoShaderCanvas'), { ssr: false })
type View = LogoPreset | 'room'

export default function LogoMotion({ playground = false }: { playground?: boolean }) {
  const [view, setView] = useState<View>('silver')
  const [background, setBackground] = useState<LogoBackground>('black')
  const [scale, setScale] = useState(90)
  const [speed, setSpeed] = useState(22)
  const [motion, setMotion] = useState(false)
  const [inView, setInView] = useState(false)
  const [status, setStatus] = useState<{ view: View; state: 'ready' | 'unavailable' } | null>(null)
  const figure = useRef<HTMLElement>(null)
  const onStatus = useCallback((state: 'ready' | 'unavailable') => setStatus({ view, state }), [view])
  const ready = status?.view === view && status.state === 'ready'
  const unavailable = status?.view === view && status.state === 'unavailable'
  const choices: View[] = playground ? Object.keys(LOGO_PRESETS) as LogoPreset[] : ['silver', 'heat', 'room']

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMotion(!preference.matches)
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const element = figure.current
    if (!element) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setInView(true)
        observer.disconnect()
      }
    }, { rootMargin: '100px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <figure ref={figure} className={`${styles.figure} ${playground ? styles.playground : ''}`}>
      <div className={styles.stage} data-view={view} data-ready={ready} style={{ backgroundColor: LOGO_BACKGROUNDS[background] }}>
        {view === 'room' ? <Image src="/brand/founder/room-mono.jpg" alt="Keegan’s workroom in Atlanta, with records and a music workstation." fill sizes="(max-width: 767px) calc(100vw - 48px), 40vw" className={styles.photo} /> : <>
          <Image src={background === 'white' ? '/brand/logo.svg' : '/brand/logo-white.svg'} alt="lecturesfrom mark" width={512} height={512} className={styles.mark} style={{ transform: `scale(${scale / 90})` }} priority />
          {inView && <LogoShaderCanvas key={view} preset={view} background={LOGO_BACKGROUNDS[background]} scale={scale / 100} speed={speed / 100} playing={motion} onStatus={onStatus} />}
        </>}
        {playground && <span className={styles.stageLabel} style={{ color: background === 'white' ? '#20262b' : '#ececec' }}>lecturesfrom / motion studies</span>}
      </div>
      <figcaption className={styles.panel}>
        {playground && <p className={styles.controlLabel}>01 / treatment</p>}
        <div className={styles.controls}>
          <div className={styles.choices} role="group" aria-label="Choose the logo treatment">
            {choices.map(option => <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>{option === 'room' ? 'room' : playground ? LOGO_PRESETS[option].label : option}</button>)}
          </div>
          {!playground && view !== 'room' && <button type="button" className={styles.motion} disabled={unavailable} onClick={() => setMotion(value => !value)} aria-label={motion ? 'Pause logo animation' : 'Play logo animation'}>{motion && !unavailable ? 'pause' : 'play'} <span aria-hidden="true">{motion && !unavailable ? 'Ⅱ' : '▷'}</span></button>}
        </div>
        {playground && <>
          <p className={styles.presetNote}>{view !== 'room' && LOGO_PRESETS[view].note}</p>
          <p className={styles.controlLabel}>02 / background</p>
          <div className={styles.backgrounds} role="group" aria-label="Choose the logo background">
            {(Object.keys(LOGO_BACKGROUNDS) as LogoBackground[]).map(option => <button key={option} type="button" aria-pressed={background === option} onClick={() => setBackground(option)}><span aria-hidden="true" style={{ backgroundColor: LOGO_BACKGROUNDS[option] }} />{option}</button>)}
          </div>
          <div className={styles.sliders}>
            <label htmlFor="logo-scale">03 / scale <output>{scale}%</output></label>
            <input id="logo-scale" type="range" min="60" max="110" step="5" value={scale} onChange={event => setScale(Number(event.target.value))} />
            <label htmlFor="logo-speed">04 / speed <output>{(speed / 100).toFixed(2)}×</output></label>
            <input id="logo-speed" type="range" min="10" max="100" step="2" value={speed} onChange={event => setSpeed(Number(event.target.value))} />
          </div>
          <button type="button" className={`house-button house-button-secondary ${styles.playButton}`} disabled={unavailable} onClick={() => setMotion(value => !value)} aria-label={motion ? 'Pause logo animation' : 'Play logo animation'}>{motion && !unavailable ? 'pause motion' : 'play motion'} <span aria-hidden="true">{motion && !unavailable ? 'Ⅱ' : '▷'}</span></button>
        </>}
        <div className={styles.caption}>
          {view === 'room' ? <>the room. atlanta, ga.<br />records on the floor. work on the screen.</> : <>{unavailable ? 'motion is unavailable here. the original mark stays visible.' : playground ? 'change a treatment. mix a background. see what hits.' : 'same mark. different energy.'}</>}
          {!playground && <Link href="/brand/motion" className={styles.explore}>play with the logo <span aria-hidden="true">↗</span></Link>}
        </div>
      </figcaption>
    </figure>
  )
}
