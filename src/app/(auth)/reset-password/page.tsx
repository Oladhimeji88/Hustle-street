import type { Metadata } from 'next'
import { RequestPasswordResetForm } from '@/components/auth/auth-forms'

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return <RequestPasswordResetForm />
}
