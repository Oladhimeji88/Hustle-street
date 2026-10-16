/** @type {import('next').NextConfig} */

// Security headers applied to every response. CSP is intentionally strict; the
// Supabase + map tile origins are injected from env so staging/production can
// differ without a code change.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321').origin
  } catch {
    return 'http://localhost:54321'
  }
})()

const mapTileOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org').origin
  } catch {
    return 'https://tile.openstreetmap.org'
  }
})()

const connectSrc = [
  "'self'",
  supabaseOrigin,
  supabaseOrigin.replace(/^http/, 'ws'),
  mapTileOrigin,
  'https://api.paystack.co',
]

const csp = [
  `default-src 'self'`,
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required for the
  // App Router runtime. Paystack's inline checkout is loaded from its own origin.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data: ${supabaseOrigin} ${mapTileOrigin} https://*.tile.openstreetmap.org`,
  `font-src 'self' data:`,
  `connect-src ${connectSrc.join(' ')}`,
  `frame-src 'self' https://checkout.paystack.com`,
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(self), payment=(self), interest-cohort=()',
  },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Pin the trace root to this project. Without it Next walks up and can pick a
  // parent lockfile, which pulls unrelated files into the serverless bundle.
  outputFileTracingRoot: process.cwd(),

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: supabaseOrigin.startsWith('https') ? 'https' : 'http',
        hostname: new URL(supabaseOrigin).hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  experimental: {
    // Keeps server action payloads bounded (image uploads go to object storage
    // directly, never through a server action).
    serverActions: { bodySizeLimit: '2mb' },
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // The service worker must never be cached by the CDN or the browser,
        // otherwise clients get stuck on a stale shell after a deploy.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ]
  },
}

export default nextConfig
