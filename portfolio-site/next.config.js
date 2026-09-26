/** @type {import('next').NextConfig} */
const houseLink = '</llms.txt>; rel="describedby"; type="text/plain"'

const houseSources = ['/', '/catalog', '/catalog/:path*', '/collection', '/legal']

const nextConfig = {
  turbopack: {
    root: __dirname,
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
  async headers() {
    return houseSources.map((source) => ({
      source,
      headers: [{ key: 'Link', value: houseLink }],
    })).concat([
      {
        source: '/robots.txt',
        headers: [{ key: 'Link', value: houseLink }],
      },
    ])
  },
}

module.exports = nextConfig
