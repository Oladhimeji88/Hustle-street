import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignInForm } from '@/components/auth/auth-forms'
import { Spinner } from '@/components/ui/feedback'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to Hustle Street to post jobs or find work near you.',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  // The form reads `next` from the query string, so it must sit inside Suspense.
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <SignInForm />
    </Suspense>
  )
}
