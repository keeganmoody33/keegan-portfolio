export const SITE_URL = 'https://www.lecturesfrom.com'

export const HOUSE_TITLE = 'lecturesfrom'
export const HOUSE_DESCRIPTION = 'sales systems, software, records, and things you can hold. an independent house by keegan moody in atlanta.'
/** Stable house share still. Nested house routes set this on openGraph so
 *  their own openGraph objects do not drop the file-convention image. */
export const HOUSE_OG_IMAGE = {
  url: '/opengraph-image',
  alt: HOUSE_TITLE,
  width: 1200,
  height: 630,
} as const

export const HOUSE_TAGLINE =
  "sales systems, software, records, and things you can hold."

export const PERSON_TITLE = 'Keegan Moody | lecturesfrom'
export const PERSON_DESCRIPTION =
  'Keegan Moody builds revenue systems from scratch. Explore his experience, browse projects, compare a role, or get in touch.'

/** GTM Engineering School certificate. Person segment only — never house routes. */
export const OG_IMAGE_PATH = '/og.jpg'

export const HOUSE_SAME_AS = [
  'https://x.com/lecturesfrom',
  'https://github.com/lecturesfrom',
  'https://github.com/keeganmoody33',
  'https://www.linkedin.com/company/lecturesfrom',
] as const

export const SOURCE_REPO = 'https://github.com/keeganmoody33/keegan-portfolio'
