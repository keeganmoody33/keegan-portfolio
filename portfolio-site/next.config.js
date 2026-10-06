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
