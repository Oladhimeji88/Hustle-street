import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignUpForm } from '@/components/auth/auth-forms'
import { Spinner } from '@/components/ui/feedback'

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Join Hustle Street. Post a job in minutes, or start earning from your skills.',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <SignUpForm />
    </Suspense>
  )
}
