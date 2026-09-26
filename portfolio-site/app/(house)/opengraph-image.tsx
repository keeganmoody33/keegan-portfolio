import { HOUSE_SHARE_SIZE, houseSharePngResponse } from '@/lib/house-share'

export const runtime = 'nodejs'
export const alt = 'lecturesfrom'
export const size = HOUSE_SHARE_SIZE
export const contentType = 'image/png'

export default function Image() {
  return houseSharePngResponse()
}
