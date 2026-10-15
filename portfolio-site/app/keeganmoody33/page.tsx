'use client'

import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import Chat, { useConversation } from '@/components/Chat'
import Image from 'next/image'
import Link from 'next/link'
import styles from './portfolio.module.css'
import JDAnalyzer from '@/components/JDAnalyzer'
import Timeline from '@/components/Timeline'
import Marquee from '@/components/Marquee'
import GitHubActivity from '@/components/GitHubActivity'
import YouTubePlayer from '@/components/YouTubePlayer'
import BannerRotator, {
  BannerAvailabilityContext,
} from '@/components/BannerRotator'
import NowPlayingLiveRegion from '@/components/NowPlayingLiveRegion'
import SignalCut from '@/components/SignalCut'
import posthog from 'posthog-js'

/** Error boundary — a single widget failure never crashes the page */
class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  static contextType = BannerAvailabilityContext
  declare context: (available: boolean) => void

  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.error('WidgetErrorBoundary caught:', error)
    this.context(false)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  headline: string
  summary: string
  linkedin_url: string
  github_url: string
}

interface Experience {
  id: number
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  duration_months: number
  public_bullets: string[]
  display_order: number
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const conversation = useConversation()
  const [careerRequest, setCareerRequest] = useState<{ company: string; at: number } | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [experienceStatus, setExperienceStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const chatDialog = useRef<HTMLDialogElement>(null)

  // Event handlers with PostHog tracking
  const handleOpenChat = () => {
    posthog.capture('chat_modal_opened', {
      source: 'page_interaction'
    })
    setShowChat(true)
  }

  const handleCloseChat = () => {
    posthog.capture('chat_modal_closed')
    setShowChat(false)
  }

  const handleExternalLinkClick = (linkName: string, url: string) => {
    posthog.capture('external_link_clicked', {
      link_name: linkName,
      destination_url: url
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    let cancelled = false
    async function fetchData() {
      setExperienceStatus('loading')
      try {
        const [profileResult, experienceResult] = await Promise.all([
          supabase.from('candidate_profile')
            .select('id,first_name,last_name,headline,summary,linkedin_url,github_url')
            .eq('id', 'keegan-moody-001').abortSignal(controller.signal).single(),
          supabase.from('experiences')
            .select('id,company_name,role_title,start_date,end_date,duration_months,public_bullets,display_order')
            .eq('candidate_id', 'keegan-moody-001')
            .order('display_order', { ascending: true }).abortSignal(controller.signal),
        ])
        if (cancelled) return
        if (profileResult.data) setProfile(profileResult.data)
        if (experienceResult.error) {
          setExperienceStatus('error')
        } else {
          setExperiences(experienceResult.data ?? [])
          setExperienceStatus('ready')
        }
      } catch {
        if (!cancelled) setExperienceStatus('error')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void fetchData()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [reload])

  useEffect(() => {
    if (!showChat) return
    const dialog = chatDialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [showChat])

  return (
    <div className={`person-page ${styles.page}`}>
      <a href="#person-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--bg-body)] focus:p-4">Skip to content</a>
      <NowPlayingLiveRegion />
      <header className={styles.nav}>
        <a href="#person-content" className={styles.name}>Keegan Moody</a>
        <nav aria-label="Personal page navigation">
          <a href="#projects">Projects</a><a href="#builds">Builds</a><a href="#experience">Experience</a><a href="#fit">Role fit</a><a href="#contact">Contact</a>
          <button onClick={handleOpenChat} className={styles.primary} aria-label="Ask AI about Keegan">Ask AI ↗</button>
        </nav>
      </header>
      <main id="person-content" tabIndex={-1}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ATLANTA, GA / SALES EXECUTION</p>
            <h1>Revenue systems.<br />Built from zero.</h1>
            <p className={styles.lede}>I build the research, outreach, and automation behind sales execution. Here’s the work, how it came together, and what I’m building next.</p>
            <div className={styles.actions}><a href="#projects" className={styles.primary}>Explore the projects ↓</a><a href="#experience" className={styles.secondary}>Read my experience ↓</a></div>
          </div>
          <aside className={styles.looking}>
            <p className={styles.eyebrow}>WHAT I’M LOOKING FOR</p><h2>Work close to<br />the sales floor.</h2>
            <p>Roles and projects where research, outreach, and automation turn into useful tools for the team.</p>
            <a href="mailto:33@lecturesfrom.com">Discuss a role or project ↗</a>
          </aside>
        </section>
        <section id="projects">
          <div className={styles.sectionHeading}><h2>Professional projects</h2><p className={styles.eyebrow}>RESEARCH → SYSTEMS → EXECUTION</p></div>
          {[
            ['Mixmax', 'OUTBOUND SYSTEMS', 'Built outbound infrastructure, account intelligence, and campaign workflows with the revenue team.'],
            ['Mobb AI', 'MARKET INTELLIGENCE', 'Connected regulatory filing research with segmentation and prospect prioritization.'],
            ['TraceAir', 'SALES DEVELOPMENT', 'Built a greenfield territory through self-sourced contacts and project-specific outreach.'],
          ].map(([name, label, description]) => <div className={styles.projectRow} key={name}><div><h3>{name}</h3><p className={styles.eyebrow}>{label}</p></div><p>{description}</p><button onClick={() => { setCareerRequest({ company: name, at: Date.now() }); document.getElementById('experience')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }}>View the work ↗</button></div>)}
        </section>
        <section id="builds" className={styles.buildsSection}>
          <div className={styles.sectionHeading}><h2>Independent builds</h2><Link href="/catalog">Open the lecturesfrom catalog ↗</Link></div>
          <div className={styles.builds}>
            {[
              ['punch2pen', 'Vocals written down, inside the session.', 'Software · In development', '/catalog/punch2pen/wordmark.svg'],
              ['proper-respect', 'The tools you use. The people who put you on.', 'Software · In development', '/catalog/proper-respect/cover.png'],
              ['yadiggg', 'A record identification device, taking shape.', 'Hardware study', '/catalog/yadiggg/wordmark.svg'],
            ].map(([name, description, status, image]) => <Link key={name} href={`/catalog/${name}`} className={styles.build}><div className={styles.buildArt} data-project={name}><Image src={image} alt="" width={390} height={178} /></div><h3>{name}<span aria-hidden="true">↗</span></h3><p>{description}</p><small>{status}</small></Link>)}
          </div>
        </section>
          {/* The work so far */}
          <section id="experience" className={styles.career}>
            <div className={styles.sectionHeading}><h2>Career history</h2><a href="https://linkedin.com/in/keeganmoody33" target="_blank" rel="noopener noreferrer">View LinkedIn ↗</a></div>
            {experienceStatus === 'loading' ? (
              <p role="status" className="font-mono text-sm text-[var(--text-muted)]">Loading career history...</p>
            ) : experienceStatus === 'error' ? (
              <div role="status" className="space-y-4 font-mono text-sm">
                <p>Career history could not load. You can retry or read my experience on LinkedIn.</p>
                <div className="flex flex-wrap gap-4">
                  <button className="ask-ai-btn min-h-11 px-4 py-2" onClick={() => setReload((value) => value + 1)}>Retry career history</button>
                  <a href="https://linkedin.com/in/keeganmoody33" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">View LinkedIn ↗</a>
                </div>
              </div>
            ) : <Timeline experiences={experiences} requestedCompany={careerRequest} />}
          </section>

          <section className={styles.tools} aria-label="Ask and compare">
            <div><h2>Ask about my work</h2><p className={styles.toolIntro}>AI answers from my experience and project notes. For a direct answer, <a href="mailto:33@lecturesfrom.com">email me</a>.</p><Chat conversation={conversation} /></div>
            <div id="fit"><h2>Have a role in mind?</h2><p className={styles.toolIntro}>Compare a job description with my experience. See relevant strengths and questions to discuss.</p><JDAnalyzer /></div>
          </section>
          <section className={styles.activity} aria-label="Music and recent activity">
            <BannerRotator labels={['Now Playing', 'GitHub activity']} controls="labels">
              <WidgetErrorBoundary><YouTubePlayer /></WidgetErrorBoundary>
              <WidgetErrorBoundary><GitHubActivity /></WidgetErrorBoundary>
            </BannerRotator>
            <Marquee />
          </section>
      </main>

      <footer id="contact" className={styles.footer}>
        <h2 className="text-3xl font-bold text-[var(--text-bright)]">Have something in mind?</h2>
        <p className="mt-4 max-w-xl text-[var(--text-main)]">A role, a project, or a good question. Send me a note with what you are working on.</p>
        <a href="mailto:33@lecturesfrom.com" className="ask-ai-btn my-6 inline-flex min-h-12 items-center px-6 py-3 font-mono">Email Keegan ↗</a>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-[var(--text-muted)] font-mono text-sm">
            © 2026 lecturesfrom · <SignalCut href="/" direction="toHouse">Back to the house ↗</SignalCut>
          </span>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <a
              href={profile?.linkedin_url || 'https://linkedin.com/in/keeganmoody33'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleExternalLinkClick('linkedin', profile?.linkedin_url || 'https://linkedin.com/in/keeganmoody33')}
              className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
            >
              LINKEDIN
            </a>
          <a
            href="https://x.com/keeganmoody33"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleExternalLinkClick('x', 'https://x.com/keeganmoody33')}
            className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
          >
            X
          </a>
          <a
            href="https://substack.com/@keeganmoody33"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleExternalLinkClick('substack', 'https://substack.com/@keeganmoody33')}
            className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
          >
            SUBSTACK
          </a>
          <a
            href={profile?.github_url || 'https://github.com/keeganmoody33'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleExternalLinkClick('github', profile?.github_url || 'https://github.com/keeganmoody33')}
            className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
          >
            GITHUB
          </a>
          <a
            href="https://discord.com/users/lecturesfrom"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleExternalLinkClick('discord', 'https://discord.com/users/lecturesfrom')}
            className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
          >
            DISCORD
          </a>
          <a
            href="https://bsky.app/profile/lecturesfrom.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleExternalLinkClick('bluesky', 'https://bsky.app/profile/lecturesfrom.bsky.social')}
            className="inline-flex min-h-11 items-center text-[var(--text-main)] underline underline-offset-4 hover:text-[var(--accent-lime)] font-mono text-sm transition-colors"
          >
            BLUESKY
          </a>
          </div>
        </div>
      </footer>

      {/* Chat Modal */}
      {showChat && (
        <dialog ref={chatDialog} aria-labelledby="chat-heading" aria-describedby="chat-description" onCancel={handleCloseChat}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])')
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }} className="person-dialog bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
              <h2 id="chat-heading" className="text-[var(--text-bright)] font-mono">Ask about Keegan</h2>
              <button
                onClick={handleCloseChat}
                aria-label="Close chat"
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--text-main)] hover:text-[var(--text-bright)]"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <p id="chat-description" className="mb-5 text-sm text-[var(--text-muted)]">AI answers from my experience and project notes. For a direct answer, <a href="mailto:33@lecturesfrom.com" className="underline underline-offset-4">email me</a>.</p>
              <Chat conversation={conversation} />
            </div>
        </dialog>
      )}
    </div>
  )
}
