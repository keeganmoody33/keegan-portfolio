export const FLIP_COPY = {
  h1: 'flip',
  lede: "look up a song. see what it sampled and what sampled it. if you want me to flip it, leave a way to reach you and i'll send the beat.",
  lookup: 'lookup',
  lookupButton: 'look up',
  lookupAria: 'look up a song',
  samples: 'samples',
  sampledIn: 'sampled in',
  empty: 'nothing on file yet',
  noMatch: 'no match for that one.',
  down: "couldn't reach everysong.",
  retry: 'retry',
  email: 'email',
  phone: 'phone',
  smsOptIn: 'text me the beat',
  submit: 'request flip',
  privacy: 'used only to send you this beat. never shared or added to a list.',
  success: 'got it. if i make it, it comes to you.',
  emailBad: "that email doesn't look right.",
  phoneBad: "that number doesn't look right.",
  contactRequired: 'leave an email or a phone.',
  smsRequired: 'check the box to get the beat by text.',
  songRequired: 'look up a song first.',
  storeDown: "couldn't store that.",
  productLead: 'building something?',
  productEmail: '33@lecturesfrom.com',
  askFlip: 'ask for a flip',
  sourceHost: 'everysong.site',
  fixtureMark: 'fixture',
  nav: 'flip',
} as const

export const FLIP_SAMPLE_CAP = 8

export function showAllLabel(total: number): string {
  return `show all (${total})`
}

export function sourceLine(checked: string | null, fixture: boolean): string {
  if (fixture) return `${FLIP_COPY.sourceHost} · ${FLIP_COPY.fixtureMark}`
  if (checked) return `${FLIP_COPY.sourceHost} · checked ${checked}`
  return FLIP_COPY.sourceHost
}

export function productInquiryLine(): string {
  return `${FLIP_COPY.productLead} ${FLIP_COPY.productEmail}`
}

export const PRODUCT_MAILTO = `mailto:${FLIP_COPY.productEmail}` as const
