import type { MetadataRoute } from 'next'
import { getCatalogPageSleeves } from '@/lib/catalog'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const sleeveRoutes = getCatalogPageSleeves().map((sleeve) => ({
    url: `${SITE_URL}/catalog/${sleeve.slug}`,
    lastModified: new Date(),
  }))

  return [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    { url: `${SITE_URL}/catalog`, lastModified: new Date() },
    ...sleeveRoutes,
    { url: `${SITE_URL}/collection`, lastModified: new Date() },
    { url: `${SITE_URL}/collection/573292`, lastModified: new Date() },
    { url: `${SITE_URL}/collection/240128`, lastModified: new Date() },
    { url: `${SITE_URL}/collection/567894`, lastModified: new Date() },
    { url: `${SITE_URL}/legal`, lastModified: new Date() },
    { url: `${SITE_URL}/brand`, lastModified: new Date() },
    { url: `${SITE_URL}/keeganmoody33`, lastModified: new Date() },
  ]
}
