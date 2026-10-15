export const FLIP_COPY = {
  h1: 'doingflips',
  h1Mark: 'flip',
  lede: 'pick a song you want me to sample. leave a way to reach you, and if i make the flip, i\'ll send it your way. finished flips live here too.',
  lookup: '1. find your song',
  lookupPlaceholder: 'song title or artist',
  lookupHint: 'type a title or artist, then choose the recording you mean.',
  lookupButton: 'find song',
  lookupAria: 'search for a song to flip',
  pick: 'pick the song you mean.',
  samples: 'this song samples',
  sampledIn: 'songs that sample this',
  empty: 'no sample connections on file yet.',
  noMatch: 'no songs found. try the artist and a few words from the title.',
  down: "song search is unavailable right now. try again, or email me the song.",
  retry: 'try search again',
  email: 'email',
  phone: 'phone',
  contactHint: 'email or phone. one is enough.',
  smsOptIn: 'text me the beat',
  submit: 'request a sample flip',
  privacy: 'your email and phone stay private. used only for this request, never added to a list.',
  success: 'got it. if i make this one, i’ll send it your way.',
  emailBad: "that email doesn't look right.",
  phoneBad: "that number doesn't look right.",
  contactRequired: 'leave an email or a phone.',
  smsRequired: 'check the box to get the beat by text.',
  songRequired: 'look up a song first.',
  storeDown: "that one didn't go through on our end. your song and contact are still here. try again, or email 33@lecturesfrom.com.",
  rateLimited: 'too many tries in a minute. give it a beat and send again.',
  connect: 'connect',
  connectLede: 'have a different idea? email me about a project or a conversation.',
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
