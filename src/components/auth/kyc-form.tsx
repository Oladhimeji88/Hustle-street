'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react'
import type { z } from 'zod'
import { kycVerifyInput, type KycResult } from '@/lib/validation/kyc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LivenessCapture } from './liveness-capture'
import type { ApiResponseBody } from '@/lib/api/response'

type Values = z.infer<typeof kycVerifyInput>

/**
 * Identity verification step.
 *
 * ── Asking for a BVN is a big ask, and the form should admit it ─────────────
 *
 * A BVN is a banking credential. Users are told, correctly and often, never to
 * give it out. A form that requests one without explaining itself reads exactly
 * like a phishing page, and the well-informed users — the ones you most want —
 * are the ones who will bounce.
 *
 * So the reassurance below is not decoration. It states plainly that the
 * numbers are not stored, which is true and enforced in the API route and the
 * migration, not merely claimed here.
 */
export function KycForm({ onDone }: { onDone?: (result: KycResult) => void }) {
  const router = useRouter()
  const [result, setResult] = React.useState<KycResult | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(kycVerifyInput),
    defaultValues: { nin: '', bvn: '', fullName: '', dateOfBirth: '', liveness: '' },
  })

  const liveness = form.watch('liveness')

  async function onSubmit(values: Values) {
    try {
      const response = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload = (await response.json()) as ApiResponseBody<KycResult>

      if (!payload.ok) {
        form.setError('root', { message: payload.error.message })
        return
      }

      // Clear the sensitive fields from component state the moment they are no
      // longer needed. React keeps them alive in the form otherwise, and there
      // is no reason for a BVN to sit in memory after the request resolves.
      form.reset({ nin: '', bvn: '', fullName: '', dateOfBirth: '', liveness: '' })

      setResult(payload.data)
      onDone?.(payload.data)
      if (payload.data.status === 'verified') router.refresh()
    } catch {
      form.setError('root', { message: 'Could not reach the server. Check your connection.' })
    }
  }

  if (result) {
    const tone =
      result.status === 'verified' ? 'money' : result.status === 'rejected' ? 'destructive' : 'muted'
    return (
      <div className="panel p-6">
        <ShieldCheck
          className={`size-5 ${tone === 'money' ? 'text-money' : tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
        <h2 className="mt-4 font-display text-lg font-semibold">
          {result.status === 'verified'
            ? 'You are verified'
            : result.status === 'pending'
              ? 'Verification is pending'
              : 'We could not verify that'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {result.reason ??
            (result.status === 'verified'
              ? 'Your identity badge is now on your profile, and payouts are unlocked.'
              : 'We will let you know as soon as this is resolved.')}
        </p>
        {result.status === 'rejected' ? (
          <Button
            variant="outline"
            className="mt-5 rounded-full"
            onClick={() => setResult(null)}
          >
            Try again
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="flex items-start gap-3 rounded-[8px] border border-border bg-surface-muted p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">
            Your NIN and BVN are not saved anywhere.
          </strong>{' '}
          They are sent once to a licensed verification service and discarded. We keep only whether
          the check passed. Hustle Street can never see or use your bank accounts with a BVN.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="kyc-name" className="text-sm font-medium">
            Full name, exactly as on your ID
          </label>
          <Input id="kyc-name" autoComplete="name" className="mt-1.5" {...form.register('fullName')} />
          {form.formState.errors.fullName ? (
            <p className="mt-1.5 text-xs text-destructive">
              {form.formState.errors.fullName.message}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              A mismatch here is the most common reason a genuine check fails.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kyc-dob" className="text-sm font-medium">
            Date of birth
          </label>
          <Input id="kyc-dob" type="date" className="mt-1.5" {...form.register('dateOfBirth')} />
          {form.formState.errors.dateOfBirth ? (
            <p className="mt-1.5 text-xs text-destructive">
              {form.formState.errors.dateOfBirth.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="kyc-nin" className="text-sm font-medium">
              NIN
            </label>
            <Input
              id="kyc-nin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              placeholder="11 digits"
              className="mt-1.5 tabular-nums"
              {...form.register('nin')}
            />
            {form.formState.errors.nin ? (
              <p className="mt-1.5 text-xs text-destructive">{form.formState.errors.nin.message}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Dial *346# to retrieve yours.</p>
            )}
          </div>

          <div>
            <label htmlFor="kyc-bvn" className="text-sm font-medium">
              BVN
            </label>
            <Input
              id="kyc-bvn"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              placeholder="11 digits"
              className="mt-1.5 tabular-nums"
              {...form.register('bvn')}
            />
            {form.formState.errors.bvn ? (
              <p className="mt-1.5 text-xs text-destructive">{form.formState.errors.bvn.message}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">Dial *565*0# to retrieve yours.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Liveness check</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            A quick photo, matched against the picture on your ID.
          </p>
          <LivenessCapture
            disabled={form.formState.isSubmitting}
            onCapture={(dataUrl) =>
              form.setValue('liveness', dataUrl ?? '', { shouldValidate: Boolean(dataUrl) })
            }
          />
          {form.formState.errors.liveness ? (
            <p className="mt-2 text-xs text-destructive">
              {form.formState.errors.liveness.message}
            </p>
          ) : null}
        </div>
      </div>

      {form.formState.errors.root ? (
        <div className="mt-6 flex items-start gap-3 rounded-[8px] border border-destructive/30 bg-destructive-soft p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        block
        className="mt-7 rounded-full"
        loading={form.formState.isSubmitting}
        loadingText="Verifying…"
        disabled={!liveness}
      >
        Verify my identity
      </Button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Required before you can withdraw earnings. You can skip it until then.
      </p>
    </form>
  )
}
