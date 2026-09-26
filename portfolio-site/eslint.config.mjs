import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    // Pre-existing person/turntable surfaces. House cut does not restyle or rewrite them.
    'app/TurntableCanvas.tsx',
    'app/keeganmoody33/**',
    'components/ActivityStream.tsx',
    'components/JDAnalyzer.tsx',
    'components/YouTubePlayer.tsx',
    'components/RecentDigs.tsx',
    'components/Timeline.tsx',
    'components/Chat.tsx',
    'components/Marquee.tsx',
    'components/BannerRotator.tsx',
    'components/GitHubActivity.tsx',
    'components/SprayText.tsx',
    'components/Publications.tsx',
    'hooks/**',
    'lib/youtube-service.ts',
    'lib/posthog-server.ts',
  ]),
])
