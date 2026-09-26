import { SITE_URL, HOUSE_DESCRIPTION, HOUSE_SAME_AS } from '@/lib/site'
import { getCatalogPageSleeves, sleeves } from '@/lib/catalog'

const organizationId = `${SITE_URL}/#organization`

export function houseOrganizationJsonLd() {
  const works = sleeves.map((sleeve) => ({
    '@type':
      sleeve.format === 'physical'
        ? 'Product'
        : sleeve.format === 'software'
          ? 'SoftwareApplication'
          : 'CreativeWork',
    name: sleeve.title,
    url:
      sleeve.slug === 'collection'
        ? `${SITE_URL}/collection`
        : `${SITE_URL}/catalog/${sleeve.slug}`,
    isPartOf: { '@id': organizationId },
  }))

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'lecturesfrom',
        legalName: 'lecturesfrom LLC',
        description: HOUSE_DESCRIPTION,
        url: SITE_URL,
        foundingDate: '2025',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Atlanta',
          addressRegion: 'GA',
          postalCode: '30316',
          addressCountry: 'US',
        },
        sameAs: [...HOUSE_SAME_AS],
        founder: {
          '@type': 'Person',
          name: 'Keegan Moody',
          url: `${SITE_URL}/keeganmoody33`,
        },
        employee: {
          '@type': 'Person',
          name: 'Keegan Moody',
          url: `${SITE_URL}/keeganmoody33`,
        },
      },
      {
        '@type': 'ItemList',
        name: 'lecturesfrom catalog',
        itemListElement: works.map((work, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: work,
        })),
      },
    ],
  }
}

export function sleeveJsonLd(slug: string) {
  const sleeve = getCatalogPageSleeves().find((item) => item.slug === slug)
  if (!sleeve) return null

  const type =
    sleeve.format === 'physical'
      ? 'Product'
      : sleeve.format === 'software'
        ? 'SoftwareApplication'
        : 'CreativeWork'

  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: sleeve.title,
    description: sleeve.aside,
    url: `${SITE_URL}/catalog/${sleeve.slug}`,
    isPartOf: {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'lecturesfrom',
      url: SITE_URL,
    },
  }
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
