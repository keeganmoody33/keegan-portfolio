import Link from 'next/link'
import LogoMotion from '@/components/house/LogoMotion'
import HomeHeadline from '@/components/house/HomeHeadline'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'
import { houseOrganizationJsonLd, JsonLd } from '@/lib/jsonld'
import styles from '@/components/house/editorial.module.css'

const projects = [
  { slug: 'punch2pen', description: 'vocals written down, inside the session.', status: 'software · in development' },
  { slug: 'proper-respect', description: 'the tools you use. the people who put you on.', status: 'software · in development' },
  { slug: 'yadiggg', description: 'a record identification device, taking shape.', status: 'hardware study' },
]

export default function HouseHome() {
  return (
    <HouseShell>
      <JsonLd data={houseOrganizationJsonLd()} />
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>LECTURESFROM / ATLANTA / INDEPENDENT</p>
            <HomeHeadline />
            <p className={styles.lede}>i’m keegan moody. when you believe in a product and i do too, i get into the work across product and business. from the first questions to development, customer feedback, iteration, operations, and reaching the right customers.</p>
            <div className={styles.actions}>
              <a href="mailto:33@lecturesfrom.com" className="house-button">talk about your product <span aria-hidden="true">↗</span></a>
              <a href="#workbench" className="house-button house-button-secondary">see what i’m building <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <LogoMotion />
        </section>
        <section className={styles.split} aria-labelledby="product-business">
          <h2 id="product-business" className={styles.sectionTitle}>product decisions.<br />business problems.</h2>
          <div className={styles.prose}>
            <p>i follow the problem across disciplines. what needs to be built, what customers are telling you, what is slowing the team down, and what gives people a reason to choose you.</p>
            <Link href="/legal" className="house-text-button">how i work <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
        <section id="workbench" aria-labelledby="workbench-title">
          <div className={styles.heading}>
            <h2 id="workbench-title" className={styles.sectionTitle}>on the workbench</h2>
            <Link href="/catalog" className="house-text-button">view the catalog <span aria-hidden="true">↗</span></Link>
          </div>
          {projects.map((project, index) => (
            <Link key={project.slug} href={`/catalog/${project.slug}`} className={styles.workRow}>
              <span className={styles.workNumber}>0{index + 1}</span>
              <h3>{project.slug}</h3>
              <p className={styles.workDescription}>{project.description}<small>{project.status}</small></p>
              <span aria-hidden="true" className={styles.workArrow}>↗</span>
            </Link>
          ))}
        </section>
      </div>
      <HouseFooter />
    </HouseShell>
  )
}
