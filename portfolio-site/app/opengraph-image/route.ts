import { houseSharePngResponse } from '@/lib/house-share'

export const runtime = 'nodejs'

export function GET() {
  return houseSharePngResponse()
}
