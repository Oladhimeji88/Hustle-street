'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail, Phone } from 'lucide-react'
import type { z } from 'zod'
import { devLoginAllowed, devPasswordFor } from '@/lib/auth/dev-bypass'
import { createClient } from '@/lib/supabase/client'
import {
  phoneStartInput,
  phoneVerifyInput,
  requestPasswordResetInput,
  resetPasswordInput,
  signInInput,
  signUpInput,
} from '@/lib/validation/account'
import { errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { CheckboxField } from '@/components/ui/controls'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/navigation'
import { toast } from '@/components/ui/toast'
import { GoogleButton } from './google-button'

/**
 * Auth forms.
 *
 * Supabase Auth handles the credential storage, hashing, session issuance and
 * refresh. These components own the product experience: clear errors, sensible
 * defaults, and never telling an attacker whether an email exists.
 */

// ─── Sign up ─────────────────────────────────────────────────────────────────

type SignUpValues = z.infer<typeof signUpInput>

export function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const intentParam = searchParams.get('intent')
  const defaultIntent: SignUpValues['intent'] =
    intentParam === 'hustle' || intentParam === 'post' ? intentParam : 'both'

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpInput),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
      acceptedTerms: undefined as never,
      intent: defaultIntent,
    },
  })

  async function onSubmit(values: SignUpValues) {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        // Consumed by the `handle_new_user` flow to seed the profile.
        data: { display_name: values.displayName, intent: values.intent },
      },
    })

    if (error) {
      // Supabase distinguishes "already registered"; we deliberately do not
      // surface that distinction, to avoid confirming which emails exist.
      form.setError('root', {
        message: error.message.toLowerCase().includes('already')
          ? 'If that email is available you will receive a confirmation link shortly.'
          : errorMessage(error),
      })
      return
    }

    // Whether a confirmation email is required is a Supabase project setting,
    // not something this form can know in advance. The session tells us: with
    // "Confirm email" off, signUp returns one and the user is already logged in.
    //
    // This used to show "check your email" unconditionally, which stranded
    // people on a screen waiting for a message that was never going to arrive —
    // the confirmation mail comes from Supabase's own mailer, whose free tier
    // sends a couple an hour at best.
    if (data.session) {
      router.push('/onboarding')
      router.refresh()
      return
    }

    setSent(true)
    router.refresh()
  }

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-money-soft text-money"
          aria-hidden="true"
        >
          <Mail className="size-6" />
        </div>
        <h1 className="mt-4 text-h4">Check your email</h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to{' '}
          <span className="font-medium text-foreground">{form.getValues('email')}</span>. Click it to
          finish setting up your account.
        </p>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground">
          Check your spam folder if it has not arrived within a few minutes. Signing in with Google
          skips this step entirely, because Google has already verified the address.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="w-full max-w-xs">
            <GoogleButton next="/onboarding" />
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Back to log in</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-h4">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        One account to post jobs and to hustle.
      </p>

      <div className="mt-6">
        <GoogleButton next={searchParams.get('next') ?? '/onboarding'} />
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          label="Your name"
          error={form.formState.errors.displayName?.message}
          required
        >
          <Input
            {...form.register('displayName')}
            placeholder="Daniel Okafor"
            autoComplete="name"
            autoFocus
          />
        </Field>

        <Field label="Email" error={form.formState.errors.email?.message} required>
          <Input
            {...form.register('email')}
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            autoComplete="email"
            leadingIcon={<Mail />}
          />
        </Field>

        <Field
          label="Password"
          error={form.formState.errors.password?.message}
          hint="At least 10 characters, with a capital letter or a number."
          required
        >
          <Input
            {...form.register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••"
            autoComplete="new-password"
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="pointer-events-auto rounded p-1 hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>

        <Field label="Confirm password" error={form.formState.errors.confirmPassword?.message} required>
          <Input
            {...form.register('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••"
            autoComplete="new-password"
          />
        </Field>

        <CheckboxField
          checked={form.watch('acceptedTerms') === true}
          onCheckedChange={(checked) =>
            form.setValue('acceptedTerms', checked as true, { shouldValidate: true })
          }
          label={
            <>
              I agree to the{' '}
              <Link href="/terms" className="text-primary-text hover:underline" target="_blank">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-primary-text hover:underline" target="_blank">
                Privacy Policy
              </Link>
            </>
          }
        />
        {form.formState.errors.acceptedTerms && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {form.formState.errors.acceptedTerms.message}
          </p>
        )}

        {form.formState.errors.root && (
          <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary-text hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}

// ─── Sign in ─────────────────────────────────────────────────────────────────

type SignInValues = z.infer<typeof signInInput>

export function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = React.useState(false)
  const next = searchParams.get('next') ?? '/home'

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInInput),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignInValues) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      // Development bypass: any email, any password. Gated in `devLoginAllowed`
      // so a production build cannot reach this branch — read the note there
      // before changing anything about it.
      if (devLoginAllowed()) {
        const devPassword = devPasswordFor(values.email)

        // Try the throwaway account first; create it if this email is new. This
        // goes through real Supabase auth rather than faking a session, so RLS,
        // the session cookie and every server component behave normally.
        const retry = await supabase.auth.signInWithPassword({
          email: values.email,
          password: devPassword,
        })

        if (retry.error) {
          const created = await supabase.auth.signUp({
            email: values.email,
            password: devPassword,
            options: { data: { display_name: values.email.split('@')[0] } },
          })
          if (created.error) {
            form.setError('root', { message: `Dev login failed: ${created.error.message}` })
            return
          }
          // Email confirmation may be required; if so there is no session yet.
          if (!created.data.session) {
            form.setError('root', {
              message:
                'Dev account created, but Supabase requires email confirmation. Turn that off in Auth settings to use the bypass.',
            })
            return
          }
        }

        router.push(next)
        router.refresh()
        return
      }

      // One message for both wrong-email and wrong-password, so the form cannot
      // be used to enumerate registered accounts.
      form.setError('root', { message: 'That email or password is not right. Try again.' })
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-h4">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Log in to keep hustling.</p>

      <Tabs defaultValue="email" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="email">
            <Mail className="size-4" aria-hidden="true" />
            Email
          </TabsTrigger>
          <TabsTrigger value="phone">
            <Phone className="size-4" aria-hidden="true" />
            Phone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <GoogleButton next={next} />

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input
                {...form.register('email')}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                leadingIcon={<Mail />}
              />
            </Field>

            <Field label="Password" error={form.formState.errors.password?.message}>
              <Input
                {...form.register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                autoComplete="current-password"
                trailingIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="pointer-events-auto rounded p-1 hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </Field>

            <div className="flex justify-end">
              <Link
                href="/reset-password"
                className="text-body-sm font-medium text-primary-text hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {form.formState.errors.root && (
              <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
              Log in
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="phone">
          <PhoneAuthForm next={next} />
        </TabsContent>
      </Tabs>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/signup" className="font-medium text-primary-text hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}

// ─── Phone / OTP ─────────────────────────────────────────────────────────────

/**
 * Phone auth.
 *
 * Phone-first login matters in Nigeria: plenty of people check email rarely but
 * have their phone in hand constantly. Supabase issues and verifies the OTP; we
 * only own the two-step UI.
 */
export function PhoneAuthForm({ next = '/home' }: { next?: string }) {
  const router = useRouter()
  const [step, setStep] = React.useState<'phone' | 'code'>('phone')
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [resendIn, setResendIn] = React.useState(0)

  const phoneForm = useForm<z.infer<typeof phoneStartInput>>({
    resolver: zodResolver(phoneStartInput),
    defaultValues: { phone: '' },
  })

  const codeForm = useForm<z.infer<typeof phoneVerifyInput>>({
    resolver: zodResolver(phoneVerifyInput),
    defaultValues: { phone: '', code: '' },
  })

  // Resend cooldown: stops both accidental double-taps and cheap SMS burning.
  React.useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  async function sendCode(phone: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone })

    if (error) {
      phoneForm.setError('root', { message: errorMessage(error) })
      return false
    }

    setPhoneNumber(phone)
    codeForm.setValue('phone', phone)
    setStep('code')
    setResendIn(60)
    toast.success('Code sent', `We sent a 6-digit code to ${phone}.`)
    return true
  }

  if (step === 'phone') {
    return (
      <form
        onSubmit={phoneForm.handleSubmit((values) => sendCode(values.phone))}
        className="space-y-4"
        noValidate
      >
        <Field
          label="Phone number"
          error={phoneForm.formState.errors.phone?.message}
          hint="We'll text you a 6-digit code."
        >
          <Input
            {...phoneForm.register('phone')}
            type="tel"
            inputMode="tel"
            placeholder="0801 234 5678"
            autoComplete="tel"
            addonStart="🇳🇬 +234"
          />
        </Field>

        {phoneForm.formState.errors.root && (
          <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
            {phoneForm.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" size="lg" block loading={phoneForm.formState.isSubmitting}>
          Send code
        </Button>
      </form>
    )
  }

  return (
    <form
      onSubmit={codeForm.handleSubmit(async (values) => {
        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
          phone: values.phone,
          token: values.code,
          type: 'sms',
        })

        if (error) {
          codeForm.setError('code', { message: 'That code is not right or has expired.' })
          return
        }

        router.push(next)
        router.refresh()
      })}
      className="space-y-4"
      noValidate
    >
      <div>
        <p className="text-sm text-muted-foreground">
          Enter the code we sent to <span className="font-medium text-foreground">{phoneNumber}</span>
        </p>
      </div>

      <Field label="6-digit code" error={codeForm.formState.errors.code?.message}>
        <Input
          {...codeForm.register('code')}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          autoComplete="one-time-code"
          autoFocus
          className="text-center font-label text-2xl tracking-[0.4em]"
        />
      </Field>

      <Button type="submit" size="lg" block loading={codeForm.formState.isSubmitting}>
        Verify and continue
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Change number
        </button>
        <button
          type="button"
          disabled={resendIn > 0}
          onClick={() => void sendCode(phoneNumber)}
          className="font-medium text-primary-text hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}

// ─── Password reset ──────────────────────────────────────────────────────────

export function RequestPasswordResetForm() {
  const [sent, setSent] = React.useState(false)

  const form = useForm<z.infer<typeof requestPasswordResetInput>>({
    resolver: zodResolver(requestPasswordResetInput),
    defaultValues: { email: '' },
  })

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-text"
          aria-hidden="true"
        >
          <Mail className="size-6" />
        </div>
        <h1 className="mt-4 text-h4">Check your email</h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          If an account exists for that address, we&rsquo;ve sent a link to reset your password.
        </p>
        <Button asChild variant="ghost" size="sm" className="mt-6">
          <Link href="/login">Back to log in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-h4">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        We&rsquo;ll email you a link to choose a new one.
      </p>

      <form
        onSubmit={form.handleSubmit(async (values) => {
          const supabase = createClient()
          await supabase.auth.resetPasswordForEmail(values.email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/settings/security/new-password`,
          })
          // Always report success — a different response for unknown emails
          // would turn this form into an account-enumeration oracle.
          setSent(true)
        })}
        className="mt-6 space-y-4"
        noValidate
      >
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            {...form.register('email')}
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            leadingIcon={<Mail />}
          />
        </Field>

        <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary-text hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}

export function NewPasswordForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<z.infer<typeof resetPasswordInput>>({
    resolver: zodResolver(resetPasswordInput),
    defaultValues: { password: '', confirmPassword: '' },
  })

  return (
    <div>
      <h1 className="text-h4">Choose a new password</h1>

      <form
        onSubmit={form.handleSubmit(async (values) => {
          const supabase = createClient()
          const { error } = await supabase.auth.updateUser({ password: values.password })

          if (error) {
            form.setError('root', { message: errorMessage(error) })
            return
          }

          toast.success('Password updated', 'You can use it the next time you log in.')
          router.push('/home')
          router.refresh()
        })}
        className="mt-6 space-y-4"
        noValidate
      >
        <Field
          label="New password"
          error={form.formState.errors.password?.message}
          hint="At least 10 characters, with a capital letter or a number."
        >
          <Input
            {...form.register('password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="pointer-events-auto rounded p-1 hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>

        <Field label="Confirm password" error={form.formState.errors.confirmPassword?.message}>
          <Input
            {...form.register('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
          />
        </Field>

        {form.formState.errors.root && (
          <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  )
}
