export const FLIP_COPY = {
  h1: 'doingflips',
  h1Mark: 'flip',
  lede: 'find a song you want me to flip. pick it, leave a way to reach you, i\'ll send the beat.',
  lookup: 'song',
  lookupPlaceholder: 'title, artist, a line you remember',
  lookupHint: 'songs only. if the name is fuzzy, pick from the list.',
  lookupButton: 'look up',
  lookupAria: 'search for a song to flip',
  pick: 'pick the song you mean.',
  samples: 'samples',
  sampledIn: 'sampled in',
  empty: 'nothing on file yet',
  noMatch: 'no match for that one.',
  down: "couldn't reach everysong.",
  retry: 'retry',
  email: 'email',
  phone: 'phone',
  contactHint: 'email or phone. one is enough.',
  smsOptIn: 'text me the beat',
  submit: 'request a sample flip',
  privacy: 'used only to send you this beat. never shared or added to a list.',
  success: 'got it. if i make it, it comes to you.',
  emailBad: "that email doesn't look right.",
  phoneBad: "that number doesn't look right.",
  contactRequired: 'leave an email or a phone.',
  smsRequired: 'check the box to get the beat by text.',
  songRequired: 'look up a song first.',
  storeDown: "couldn't store that.",
  connect: 'connect',
  connectLede: 'jump on a call, or inquire about services.',
  productEmail: '33@lecturesfrom.com',
  askFlip: 'request a sample flip',
  sourceHost: 'everysong.site',
  fixtureMark: 'fixture',
  nav: 'doingflips',
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
  return `${FLIP_COPY.connect} ${FLIP_COPY.connectLede} ${FLIP_COPY.productEmail}`
}

export function songFieldLabel(song: { title: string; artist: string }): string {
  return `${song.title} · ${song.artist}`
}

export const PRODUCT_MAILTO = `mailto:${FLIP_COPY.productEmail}` as const
