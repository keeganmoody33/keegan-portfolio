import type { MatchStatus } from './types.ts'

export function matchRank(status: MatchStatus): number {
  switch (status) {
    case 'matched':
      return 3
    case 'ambiguous':
      return 2
    case 'unmatched':
      return 1
    case 'pending':
      return 0
    default: {
      const _never: never = status
      return _never
    }
  }
}
