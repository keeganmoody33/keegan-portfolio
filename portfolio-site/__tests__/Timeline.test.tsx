import { render, screen } from '@testing-library/react'
import Timeline from '../components/Timeline'
import '@testing-library/jest-dom'

// Mock PostHog
jest.mock('posthog-js', () => ({
  capture: jest.fn(),
}))

// Mock next/script
jest.mock('next/script', () => {
  return function MockScript({ src, onLoad }: { src: string; onLoad?: () => void }) {
    // Auto-trigger onLoad for YouTube API script
    if (src?.includes('youtube') && onLoad) {
      setTimeout(onLoad, 0)
    }
    return null
  }
})

const mockExperiences = [
  {
    id: 1,
    company_name: 'Test Company',
    role_title: 'Test Role',
    start_date: '2023-01-01',
    end_date: '2023-12-31',
    duration_months: 12,
    public_bullets: [
      'Achieved 150% of quota in Q1 2023',
      'Built pipeline worth $2M in ARR',
      'Trained 3 new SDRs on outreach best practices',
    ],
  },
  {
    id: 2,
    company_name: 'Another Company',
    role_title: 'Another Role',
    start_date: '2022-01-01',
    end_date: '2022-12-31',
    duration_months: 12,
    public_bullets: [
      'Single bullet point for this role',
    ],
  },
  {
    id: 3,
    company_name: 'No Bullets Company',
    role_title: 'No Bullets Role',
    start_date: '2021-01-01',
    end_date: '2021-12-31',
    duration_months: 12,
    public_bullets: [],
  },
]

describe('Timeline', () => {
  it('renders without crashing when experiences are provided', () => {
    render(<Timeline experiences={mockExperiences} />)
    expect(screen.getByText('Test Company')).toBeInTheDocument()
    expect(screen.getByText('Another Company')).toBeInTheDocument()
  })

  it('renders each bullet as a separate list item', () => {
    render(<Timeline experiences={mockExperiences} />)
    
    // Check that all bullets from first experience are rendered as list items
    expect(screen.getByText('Achieved 150% of quota in Q1 2023')).toBeInTheDocument()
    expect(screen.getByText('Built pipeline worth $2M in ARR')).toBeInTheDocument()
    expect(screen.getByText('Trained 3 new SDRs on outreach best practices')).toBeInTheDocument()
    
    // Check bullet from second experience
    expect(screen.getByText('Single bullet point for this role')).toBeInTheDocument()
  })

  it('renders bullets in a ul element with proper list styling', () => {
    const { container } = render(<Timeline experiences={mockExperiences} />)
    
    // Find all ul elements (should be at least 2 - one for each experience with bullets)
    const lists = container.querySelectorAll('ul')
    expect(lists.length).toBeGreaterThanOrEqual(2)
    
    // Check that list has proper Tailwind classes for list styling
    const firstList = lists[0]
    expect(firstList).toHaveClass('list-disc')
    expect(firstList).toHaveClass('list-inside')
  })

  it('renders each bullet as an li element', () => {
    const { container } = render(<Timeline experiences={mockExperiences} />)
    
    // Get the first experience's list
    const lists = container.querySelectorAll('ul')
    const firstList = lists[0]
    const listItems = firstList.querySelectorAll('li')
    
    expect(listItems.length).toBe(3)
    expect(listItems[0]).toHaveTextContent('Achieved 150% of quota in Q1 2023')
    expect(listItems[1]).toHaveTextContent('Built pipeline worth $2M in ARR')
    expect(listItems[2]).toHaveTextContent('Trained 3 new SDRs on outreach best practices')
  })

  it('handles empty public_bullets array gracefully', () => {
    const { container } = render(<Timeline experiences={mockExperiences} />)
    
    // The third experience has empty bullets, so it shouldn't render a list
    // We should still have exactly 2 lists (for the first two experiences)
    const lists = container.querySelectorAll('ul')
    expect(lists.length).toBe(2)
  })

  it('handles missing public_bullets property gracefully', () => {
    const experienceWithNoBulletsProp = {
      id: 4,
      company_name: 'Missing Bullets Prop',
      role_title: 'Some Role',
      start_date: '2020-01-01',
      end_date: '2020-12-31',
      duration_months: 12,
    }
    
    // @ts-expect-error - testing missing property
    const { container } = render(<Timeline experiences={[experienceWithNoBulletsProp]} />)
    
    // Should still render without error
    expect(screen.getByText('Missing Bullets Prop')).toBeInTheDocument()
    
    // No list should be rendered (query by ul elements with the list-disc class)
    const lists = container.querySelectorAll('ul.list-disc')
    expect(lists.length).toBe(0)
  })

  it('shows loading state when no experiences are provided', () => {
    render(<Timeline experiences={[]} />)
    expect(screen.getByText('Loading experiences...')).toBeInTheDocument()
  })

  it('shows loading state when experiences is undefined', () => {
    // @ts-expect-error - testing undefined prop
    render(<Timeline experiences={undefined} />)
    expect(screen.getByText('Loading experiences...')).toBeInTheDocument()
  })

  it('matches snapshot', () => {
    const { container } = render(<Timeline experiences={mockExperiences} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
