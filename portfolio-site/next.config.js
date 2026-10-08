/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.discogs.com' },
      { protocol: 'https', hostname: 'img.discogs.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
    ],
  },
  async headers() {
    return [
      {
        // stable logo URLs: always the current file, refreshed within the hour
        source: '/brand/:file((?!v/).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        // content-hashed copies never change
        source: '/brand/v/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/keegan',
        destination: '/keeganmoody33',
        statusCode: 301,
      },
    ]
  },
}

module.exports = nextConfig
