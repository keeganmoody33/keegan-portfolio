import type { Metadata } from 'next'
import { markdownTwinPath } from '@/lib/agent'
import {
  HOUSE_DESCRIPTION,
  HOUSE_TITLE,
  OG_IMAGE_PATH,
  PERSON_DESCRIPTION,
  PERSON_TITLE,
  SITE_URL,
} from '@/lib/site'

function absoluteUrl(path: string): string {
  if (path === '/') return SITE_URL
  return `${SITE_URL}${path}`
}

export function houseMetadata(path: string, title: string, description: string): Metadata {
  const url = absoluteUrl(path)
  const twin = markdownTwinPath(path)
  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: twin
        ? {
            'text/markdown': `${SITE_URL}${twin}`,
          }
        : undefined,
    },
    openGraph: {
      type: 'website',
      url,
      siteName: HOUSE_TITLE,
      title,
      description,
      images: [
        {
          url: OG_IMAGE_PATH,
          alt: HOUSE_TITLE,
          width: 800,
          height: 478,
        },
      ],
    },
  }
}

export function rootHouseMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    ...houseMetadata('/', HOUSE_TITLE, HOUSE_DESCRIPTION),
  }
}

export function personMetadata(): Metadata {
  const url = `${SITE_URL}/keeganmoody33`
  return {
    title: PERSON_TITLE,
    description: PERSON_DESCRIPTION,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'profile',
      firstName: 'Keegan',
      lastName: 'Moody',
      url,
      siteName: HOUSE_TITLE,
      title: PERSON_TITLE,
      description: PERSON_DESCRIPTION,
      images: [
        {
          url: OG_IMAGE_PATH,
          alt: PERSON_TITLE,
          width: 800,
          height: 478,
        },
      ],
    },
  }
}
