'use client'

import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import Chat from '@/components/Chat'
import JDAnalyzer from '@/components/JDAnalyzer'
import SprayText from '@/components/SprayText'
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
    <div className="person-page min-h-screen overflow-x-hidden">
      <a href="#person-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[var(--bg-body)] focus:p-4">Skip to content</a>
      <NowPlayingLiveRegion />
      <header>
        {/* Marquee Ticker */}
        <Marquee />

        {/* Rotating Banner — one widget visible at a time, auto-cycles */}
        <BannerRotator labels={['Now Playing', 'GitHub']}>
          <WidgetErrorBoundary>
            <YouTubePlayer />
          </WidgetErrorBoundary>
          <WidgetErrorBoundary>
            <GitHubActivity />
          </WidgetErrorBoundary>
        </BannerRotator>
      </header>

      <main id="person-content" tabIndex={-1} className="min-w-0 px-4 sm:px-8 lg:px-16 py-8">
          {/* Navigation */}
          <nav aria-label="Personal page navigation" className="mb-12 flex flex-wrap items-center justify-between gap-3 sm:mb-16">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-mono text-sm">/</span>
              <SignalCut
                href="/"
                direction="toHouse"
                className="inline-flex min-h-11 items-center text-[var(--text-bright)] font-space"
              >
                lecturesfrom
              </SignalCut>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-8">
              <a href="#experience" className="inline-flex min-h-11 items-center whitespace-nowrap text-[var(--text-main)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                Experience
              </a>
              <a href="/catalog" className="inline-flex min-h-11 items-center whitespace-nowrap text-[var(--text-main)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                Projects
              </a>
              <a href="#fit" className="inline-flex min-h-11 items-center whitespace-nowrap text-[var(--text-main)] hover:text-[var(--accent-lime)] font-mono text-sm">Role fit</a>
              <a href="#contact" className="inline-flex min-h-11 items-center whitespace-nowrap text-[var(--text-main)] hover:text-[var(--accent-lime)] font-mono text-sm transition-colors">
                Contact
              </a>
              <button
                onClick={handleOpenChat}
                aria-label="Ask AI about Keegan"
                className="ask-ai-btn inline-flex min-h-11 items-center whitespace-nowrap px-3 py-2 sm:px-4 font-mono text-sm"
              >
                Ask AI
              </button>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="mb-24">
            {/* Taglines */}
            <div className="space-y-2 mb-8">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-orange)]">//</span>
                <span className="font-mono text-sm">Revenue systems. Built from zero.</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-lime)]">//</span>
                <span className="font-mono text-sm">Useful in every room.</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span className="text-[var(--accent-red)]">//</span>
                <span className="font-mono text-sm">Here for the long build.</span>
              </div>
            </div>

            {/* Name */}
            <h1 className="text-5xl sm:text-7xl lg:text-9xl font-bold tracking-tight mb-8">
              <SprayText
                text={profile?.first_name?.toUpperCase() || 'KEEGAN'}
                className="text-[var(--accent-lime)]"
              />
              <br />
              <SprayText
                text={profile?.last_name?.toUpperCase() || 'MOODY'}
                className="text-[var(--accent-orange)]"
                delay={500}
              />
            </h1>

            {/* CTA */}
            <div className="flex items-start gap-4">
              <div className="w-1 h-16 bg-[var(--accent-lime)]" />
              <div>
                <p className="text-[var(--text-muted)] font-mono text-sm mb-4">
                  I build the research, outreach, and automation behind sales execution.<br />
                  Read my experience, explore the projects, or ask the AI about my work.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                <a href="#experience" className="ask-ai-btn inline-flex min-h-12 items-center px-6 py-3 font-mono">Read my experience</a>
                <button
                  onClick={handleOpenChat}
                  aria-label="Ask AI about Keegan"
                  className="inline-flex min-h-12 items-center border border-[var(--text-muted)] px-6 py-3 font-mono text-[var(--text-bright)]"
                >
                  Ask about my work
                </button>
                </div>
              </div>
            </div>
          </section>

          {/* The work so far */}
          <section id="experience" className="mb-24">
            <h2 className="text-[var(--accent-orange)] font-mono text-sm mb-8">
              // Experience
            </h2>
            <h3 className="text-3xl font-bold text-[var(--text-bright)] mb-12">
              The work so far
            </h3>
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
            ) : <Timeline experiences={experiences} />}
          </section>

          {/* JD Analyzer */}
          <section id="fit" className="mb-24">
            <h2 className="text-[var(--accent-orange)] font-mono text-sm mb-8">
              // Considering a role?
            </h2>
            <h3 className="text-3xl font-bold text-[var(--text-bright)] mb-8">
              Compare a role with my experience
            </h3>
            <p className="text-[var(--text-muted)] mb-8 max-w-xl">
              Paste a job description or its link. The AI compares it with my experience and identifies relevant strengths and open questions. Use it to start a conversation.
            </p>
            <JDAnalyzer />
          </section>
      </main>

      <footer id="contact" className="border-t border-[var(--border-dim)] px-4 pb-8 pt-8 sm:px-8 lg:px-16">
        <h2 className="text-3xl font-bold text-[var(--text-bright)]">Have something in mind?</h2>
        <p className="mt-4 max-w-xl text-[var(--text-main)]">A role, a project, or a good question. Send me a note with what you are working on.</p>
        <a href="mailto:33@lecturesfrom.com" className="ask-ai-btn my-6 inline-flex min-h-12 items-center px-6 py-3 font-mono">Email Keegan ↗</a>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-[var(--text-muted)] font-mono text-sm">
            © 2026 lecturesfrom
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
              <Chat />
            </div>
        </dialog>
      )}
    </div>
  )
}
