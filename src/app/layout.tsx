import type { Metadata, Viewport } from 'next'
import { body, display } from './fonts'
import { publicEnv } from '@/lib/config/env'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

const APP_NAME = 'Hustle Street'
const APP_DESCRIPTION =
  'Hustle Street connects you with skilled people nearby who are ready to get the job done. Post a job in minutes, or find work near you.'

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${APP_NAME} — Get things done. Find people who can.`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    'find work Lagos', 'hire artisan Nigeria', 'odd jobs Lagos', 'freelance Nigeria',
    'plumber near me', 'cleaner Lagos', 'handyman Nigeria', 'gigs Lagos',
  ],
  authors: [{ name: APP_NAME }],
  manifest: '/manifest.webmanifest',

  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: publicEnv.NEXT_PUBLIC_APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — Get things done. Find people who can.`,
    description: APP_DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: APP_NAME }],
  },

  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Get things done. Find people who can.`,
    description: APP_DESCRIPTION,
    images: ['/og.png'],
  },

  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },

  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },

  formatDetection: { telephone: false },

  // Staging must never be indexed — a duplicate marketplace in search results
  // is worse than no marketplace.
  robots:
    publicEnv.NEXT_PUBLIC_APP_ENV === 'production'
      ? { index: true, follow: true }
      : { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block zoom: pinch-to-zoom is an accessibility requirement (WCAG 1.4.4).
  maximumScale: 5,
  viewportFit: 'cover',
  // One colour: the app renders light regardless of the OS setting, so offering
  // a dark browser chrome would leave the address bar mismatched with the page.
  themeColor: '#FAF9F7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body>
        {/* Keyboard users must be able to skip the nav on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
