import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import HouseFooter from '@/components/house/HouseFooter'
import HouseRail from '@/components/house/HouseRail'
import TitleCard from '@/components/house/TitleCard'

function isElementOf(
  child: ReactNode,
  type: ReactElement['type']
): child is ReactElement {
  return isValidElement(child) && child.type === type
}

export default function HouseShell({ children }: { children: ReactNode }) {
  const before: ReactNode[] = []
  const content: ReactNode[] = []
  const after: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isElementOf(child, HouseFooter)) {
      after.push(child)
      return
    }
    if (isElementOf(child, TitleCard)) {
      before.push(child)
      return
    }
    if (isElementOf(child, HouseRail)) {
      before.push(<header key="house-rail">{child}</header>)
      return
    }
    content.push(child)
  })

  return (
    <div className="house">
      <a href="#house-content" className="house-skip">
        skip to content
      </a>
      {Children.toArray(before)}
      <main id="house-content">{Children.toArray(content)}</main>
      {Children.toArray(after)}
    </div>
  )
}
