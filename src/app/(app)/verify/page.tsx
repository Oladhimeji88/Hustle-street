import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { getCurrentUser } from '@/lib/supabase/server'
import { KycForm } from '@/components/auth/kyc-form'

export const metadata: Metadata = {
  title: 'Verify your identity',
  description: 'Confirm your identity with your NIN, BVN and a quick liveness check.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/verify')

  return (
    <div className="container max-w-2xl py-12 sm:py-16">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-money-soft text-money">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </div>

      <h1 className="mt-6 text-h3">Verify your identity</h1>
      <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
        Required once, before your first withdrawal. It is what lets posters know the person coming
        to their home is who they say they are, and it is the same check that protects you from
        someone impersonating you.
      </p>

      <div className="mt-10">
        <KycForm />
      </div>
    </div>
  )
}
