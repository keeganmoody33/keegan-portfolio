/** @type {import('next').NextConfig} */
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
}

module.exports = nextConfig
