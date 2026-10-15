'use client'

import { useEffect, useState } from 'react'
import styles from './timeline.module.css'
import Publications from './Publications'
import posthog from 'posthog-js'

interface Experience {
  id: number
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  duration_months: number
  public_bullets: string[]
}

interface TimelineProps {
  experiences: Experience[]
  requestedCompany?: { company: string; at: number } | null
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years === 0) return `${remainingMonths} mo`
  if (remainingMonths === 0) return `${years} yr`
  return `${years} yr ${remainingMonths} mo`
}

const filters = ['All experience', 'Sales + GTM', 'Research', 'Education + service'] as const
function category(exp: Experience) {
  if (isASGMResearch(exp.company_name) || /research|scientist/i.test(exp.role_title)) return 'Research'
  if (/sales|gtm|go.to.market|business development|account executive|revenue/i.test(exp.role_title)) return 'Sales + GTM'
  return 'Education + service'
}
const normalizeCompany = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '').replace(/ai$/, '')

export default function Timeline({ experiences, requestedCompany }: TimelineProps) {
  const [filter, setFilter] = useState<string>('All experience')
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!requestedCompany) return
    const exp = experiences.find(item => normalizeCompany(item.company_name).includes(normalizeCompany(requestedCompany.company)))
    setFilter('All experience')
    setShowAll(true)
    if (exp) {
      setExpanded(previous => new Set([...previous, exp.id]))
      requestAnimationFrame(() => document.getElementById(`career-${exp.id}`)?.querySelector('summary')?.focus({ preventScroll: true }))
    }
  }, [requestedCompany, experiences])
  const filtered = experiences.filter(exp => filter === 'All experience' || category(exp) === filter)
  const visible = showAll || filter !== 'All experience' ? filtered : filtered.slice(0, 3)
  return (
    <div>
      <div className={styles.filters} aria-label="Filter career history">
        {filters.map(label => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
      </div>
      <p className="sr-only" role="status">{filtered.length} career entries in {filter}</p>
      {!visible.length && <p className={styles.empty}>No entries in this view. Choose another filter or <a href="https://linkedin.com/in/keeganmoody33" target="_blank" rel="noopener noreferrer">view LinkedIn ↗</a>.</p>}
      {visible.map(exp => <details key={exp.id} id={`career-${exp.id}`} className={styles.row} open={expanded.has(exp.id)} onToggle={event => {
        const isOpen = event.currentTarget.open
        setExpanded(previous => { if (previous.has(exp.id) === isOpen) return previous; const next = new Set(previous); if (isOpen) next.add(exp.id); else next.delete(exp.id); return next })
      }}>
        <summary><span className={styles.year}>{new Date(exp.start_date).getUTCFullYear()}</span><span className={styles.company}>{exp.company_name}</span><span className={styles.role}>{exp.role_title}</span><span className={styles.action}>{expanded.has(exp.id) ? 'Close details ↑' : 'Details + tools ↓'}</span></summary>
        <div className={styles.details}>
          <p className={styles.dates}>{formatDate(exp.start_date)} to {exp.end_date ? formatDate(exp.end_date) : 'Present'} · {formatDuration(exp.duration_months)}</p>
          <p className={styles.companyLink}><CompanyLink company={exp.company_name} /></p>
          {exp.public_bullets?.length > 0 && <ul>{exp.public_bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>}
          <div className={styles.tech}>{getTechStack(exp.company_name).map(tech => <span key={tech}>{tech}</span>)}</div>
          {isASGMResearch(exp.company_name) && <div className="mt-6"><h3 className="mb-4 font-semibold">Peer-reviewed publications</h3><Publications /></div>}
        </div>
      </details>)}
      <div className={styles.actions}>
        {filter === 'All experience' && experiences.length > 3 && <button onClick={() => setShowAll(value => !value)}>{showAll ? 'Show recent career history ↑' : 'Show full career history ↓'}</button>}
        <button onClick={() => { setFilter('Research'); setShowAll(true); setExpanded(new Set(experiences.filter(exp => category(exp) === 'Research').map(exp => exp.id))) }}>Research publications ↗</button>
      </div>
    </div>
  )
}

function CompanyLink({ company }: { company: string }) {
  // Company URL mapping - all AI-domain companies linked
  // AI trajectory: Biofourmis.com → Mobb.AI → Mixmax.ai + Traceair.net (drone tech)
  const urlMap: Record<string, string> = {
    'Mixmax': 'https://mixmax.ai',
    'Mobb': 'https://mobb.ai',
    'Traceair': 'https://traceair.net',
    'TraceAir': 'https://traceair.net',
    'Trace Air': 'https://traceair.net',
    'Biofourmis': 'https://biofourmis.com',
    'Bariatric': 'https://bcofa.com',
    'BARINAV': 'https://bcofa.com',
    'Barbour': 'https://barbourortho.com',
    'Camp Horizon': 'https://camphorizon.net',
    'Chapel Hill': 'https://www.fultonschools.org',
  }

  const url = Object.entries(urlMap).find(([key]) =>
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1]

  if (url) {
    const handleCompanyClick = () => {
      posthog.capture('company_link_clicked', {
        company_name: company,
        destination_url: url
      })
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleCompanyClick}
        aria-label={`${company} (opens in new tab)`}
        className="hover:text-[var(--accent-lime)] transition-colors"
      >
        {company}
      </a>
    )
  }

  return <span>{company}</span>
}

function getTechStack(company: string): string[] {
  // Tech stack mapping - ideally this would come from database
  const techMap: Record<string, string[]> = {
    'Mixmax': ['Clay', 'SmartLead', 'HeyReach', 'Scalemail', 'Disco', 'Notion', 'LinkedIn Sales Nav'],
    'Mobb': ['Koncert', 'Apollo.io', 'HubSpot', 'LinkedIn Sales Nav'],
    'Traceair': ['SalesLoft', 'Salesforce', 'HubSpot', 'Clay', 'LinkedIn Sales Nav'],
    'TraceAir': ['SalesLoft', 'Salesforce', 'HubSpot', 'Clay', 'LinkedIn Sales Nav'],
    'Trace Air': ['SalesLoft', 'Salesforce', 'HubSpot', 'Clay', 'LinkedIn Sales Nav'],
    'Biofourmis': ['Salesforce', 'HubSpot', 'ZoomInfo', 'Outreach', 'LinkedIn Sales Nav'],
    'Bariatric': ['HubSpot', 'LinkedIn Sales Nav'],
  }

  return Object.entries(techMap).find(([key]) =>
    company.toLowerCase().includes(key.toLowerCase())
  )?.[1] || []
}

function isASGMResearch(company: string): boolean {
  const keywords = ['asgm', 'mercury', 'epa', 'research']
  return keywords.some(keyword => company.toLowerCase().includes(keyword))
}
