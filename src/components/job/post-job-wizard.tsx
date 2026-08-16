'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarClock,
  Check,
  Clock,
  Globe,
  MapPin,
  Users,
  Zap,
} from 'lucide-react'
import { apiRequest } from '@/hooks/use-jobs'
import { useLocation } from '@/components/location/location-provider'
import { CATEGORY_EMOJI } from './job-card'
import { formatMoney, parseMoneyInput, toMinor } from '@/lib/money'
import { errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { RadioCard, RadioGroup } from '@/components/ui/controls'
import { Chip } from '@/components/ui/chip'
import { toast } from '@/components/ui/toast'
import type { Category } from '@/types/database'

type CategorySummary = Pick<Category, 'id' | 'slug' | 'name' | 'min_budget_minor'>

interface Draft {
  title: string
  description: string
  categoryId: string
  locationKind: 'onsite' | 'remote'
  lat?: number
  lng?: number
  areaLabel?: string
  city?: string
  scheduleKind: 'asap' | 'today' | 'tomorrow' | 'date' | 'flexible'
  scheduledFor?: string
  budgetKind: 'fixed' | 'negotiable' | 'hourly'
  budgetInput: string
  requirements: string[]
  visibility: 'nearby' | 'category' | 'invite_only'
}

const STEPS = [
  'What do you need done?',
  'Tell them more',
  'Pick a category',
  'Where?',
  'When?',
  'Your budget',
  'Any requirements?',
  'Who should see it?',
  'Review and publish',
] as const

const REQUIREMENT_PRESETS = [
  'Must have a vehicle',
  'Must bring own tools',
  'Experience required',
  'Must be available today',
  'ID verified only',
  'Must be able to lift heavy items',
]

/**
 * Post-a-job wizard.
 *
 * Nine short steps rather than one long form. The brief asks for "under a few
 * minutes", and the way to get there on a phone is one decision per screen with
 * a visible finish line — not a wall of inputs.
 *
 * The draft is persisted to the database as soon as step 3 is complete, so a
 * dropped connection halfway through never loses someone's work.
 */
export function PostJobWizard({ categories }: { categories: CategorySummary[] }) {
  const router = useRouter()
  const { coords, label: locationLabel, isResolved, requestDeviceLocation, locating } = useLocation()

  const [step, setStep] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [draft, setDraft] = React.useState<Draft>({
    title: '',
    description: '',
    categoryId: '',
    locationKind: 'onsite',
    scheduleKind: 'flexible',
    budgetKind: 'fixed',
    budgetInput: '',
    requirements: [],
    visibility: 'nearby',
  })

  const update = React.useCallback(
    (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  )

  const selectedCategory = categories.find((category) => category.id === draft.categoryId)
  const budgetMinor = parseMoneyInput(draft.budgetInput)

  // Per-step validity. The Continue button reflects it rather than letting
  // someone advance and then bounce back with an error.
  const stepValid = React.useMemo(() => {
    switch (step) {
      case 0:
        return draft.title.trim().length >= 6
      case 1:
        return draft.description.trim().length >= 20
      case 2:
        return Boolean(draft.categoryId)
      case 3:
        return draft.locationKind === 'remote' || (isResolved && coords !== undefined)
      case 4:
        return draft.scheduleKind !== 'date' || Boolean(draft.scheduledFor)
      case 5:
        if (draft.budgetKind === 'negotiable') return true
        if (!budgetMinor || budgetMinor <= 0) return false
        if (selectedCategory?.min_budget_minor && budgetMinor < selectedCategory.min_budget_minor) {
          return false
        }
        return true
      default:
        return true
    }
  }, [step, draft, budgetMinor, selectedCategory, isResolved, coords])

  async function publish() {
    setSubmitting(true)
    setError(null)

    try {
      // 1. Create the draft.
      const { data: job } = await apiRequest<{ id: string }>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim(),
          categoryId: draft.categoryId,
          locationKind: draft.locationKind,
          lat: draft.locationKind === 'remote' ? undefined : coords.lat,
          lng: draft.locationKind === 'remote' ? undefined : coords.lng,
          areaLabel: draft.locationKind === 'remote' ? undefined : locationLabel,
          scheduleKind: draft.scheduleKind,
          scheduledFor: draft.scheduledFor,
          urgency:
            draft.scheduleKind === 'asap'
              ? 'asap'
              : draft.scheduleKind === 'today'
                ? 'today'
                : draft.scheduleKind === 'date'
                  ? 'scheduled'
                  : 'flexible',
          budgetKind: draft.budgetKind,
          budgetMinMinor: budgetMinor ?? undefined,
          currency: 'NGN',
          visibility: draft.visibility,
          requirements: draft.requirements.map((requirement) => ({
            label: requirement,
            kind: 'custom' as const,
            isMandatory: true,
          })),
          media: [],
        }),
      })

      // 2. Publish it. Separate call because publishing runs the limit checks
      //    and the notification fan-out.
      const { data: result } = await apiRequest<{ notifiedCount: number }>(
        `/api/jobs/${job.id}/publish`,
        { method: 'POST' },
      )

      toast.success(
        'Your job is live',
        result.notifiedCount > 0
          ? `${result.notifiedCount} hustlers nearby were notified.`
          : 'Hustlers nearby can see it now.',
      )

      router.push(`/my-jobs/${job.id}?published=1`)
      router.refresh()
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  const isLastStep = step === STEPS.length - 1

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 pt-4 sm:px-6">
      {/* Progress */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 pb-3 pt-2 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? router.back() : setStep((value) => value - 1))}
            aria-label="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="flex-1">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label="Progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step + 1}/{STEPS.length}
          </span>
        </div>
      </div>

      <h1 className="mt-6 text-h5">{STEPS[step]}</h1>

      <div className="mt-5">
        {/* ── 0. Title ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <Field
            hint="Be specific — “Help me move a sofa” gets better responses than “Need help”."
            counter={{ current: draft.title.length, max: 120 }}
          >
            <Input
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Help me move a sofa"
              maxLength={120}
              inputSize="lg"
              autoFocus
            />
          </Field>
        )}

        {/* ── 1. Description ───────────────────────────────────────────── */}
        {step === 1 && (
          <Field
            hint="What exactly needs doing? Mention anything that affects the price — floors, sizes, distance, timing."
            counter={{ current: draft.description.length, max: 5000 }}
          >
            <Textarea
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Moving a 3-seater sofa from a 2nd floor flat to a house about 15 minutes away. No lift, so it needs two people. Should take around 3 hours."
              maxLength={5000}
              rows={7}
              autoFocus
            />
          </Field>
        )}

        {/* ── 2. Category ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {categories.map((category) => {
              const selected = draft.categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => update({ categoryId: category.id })}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center transition-all ${
                    selected
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {CATEGORY_EMOJI[category.slug] ?? '🛠️'}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{category.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── 3. Location ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <RadioGroup
              value={draft.locationKind}
              onValueChange={(value) => update({ locationKind: value as Draft['locationKind'] })}
            >
              <RadioCard
                value="onsite"
                label="Somewhere specific"
                description="Someone needs to come to a location"
                icon={<MapPin />}
              />
              <RadioCard
                value="remote"
                label="Can be done remotely"
                description="Design, writing, development and similar"
                icon={<Globe />}
              />
            </RadioGroup>

            {draft.locationKind === 'onsite' && (
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-medium">Job location</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {isResolved ? locationLabel : 'Not set yet'}
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  loading={locating}
                  onClick={() => void requestDeviceLocation()}
                >
                  {isResolved ? 'Update location' : 'Use my location'}
                </Button>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Hustlers only see an approximate area and distance. Your exact address is shared
                  with the person you hire, once the job is active.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── 4. Schedule ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <RadioGroup
              value={draft.scheduleKind}
              onValueChange={(value) => update({ scheduleKind: value as Draft['scheduleKind'] })}
            >
              <RadioCard value="asap" label="As soon as possible" description="Urgent — needed right now" icon={<Zap />} />
              <RadioCard value="today" label="Today" icon={<Clock />} />
              <RadioCard value="tomorrow" label="Tomorrow" icon={<CalendarClock />} />
              <RadioCard value="date" label="Pick a date and time" icon={<Calendar />} />
              <RadioCard value="flexible" label="I'm flexible" description="Whenever suits the hustler" icon={<CalendarClock />} />
            </RadioGroup>

            {draft.scheduleKind === 'date' && (
              <Field label="When?">
                <Input
                  type="datetime-local"
                  value={draft.scheduledFor ?? ''}
                  min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                  onChange={(event) => update({ scheduledFor: event.target.value })}
                />
              </Field>
            )}
          </div>
        )}

        {/* ── 5. Budget ────────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            <RadioGroup
              value={draft.budgetKind}
              onValueChange={(value) => update({ budgetKind: value as Draft['budgetKind'] })}
            >
              <RadioCard value="fixed" label="Fixed price" description="One agreed amount for the whole job" />
              <RadioCard value="hourly" label="Hourly rate" description="Pay for the time it takes" />
              <RadioCard value="negotiable" label="Open to offers" description="Let hustlers propose a price" />
            </RadioGroup>

            {draft.budgetKind !== 'negotiable' && (
              <Field
                label={draft.budgetKind === 'hourly' ? 'Rate per hour' : 'Your budget'}
                error={
                  budgetMinor &&
                  selectedCategory?.min_budget_minor &&
                  budgetMinor < selectedCategory.min_budget_minor
                    ? `Minimum for ${selectedCategory.name} is ${formatMoney(selectedCategory.min_budget_minor)}`
                    : undefined
                }
                hint="You can still negotiate with applicants."
              >
                <Input
                  value={draft.budgetInput}
                  onChange={(event) => update({ budgetInput: event.target.value })}
                  placeholder="15,000"
                  inputMode="decimal"
                  addonStart="₦"
                  inputSize="lg"
                  autoFocus
                />
              </Field>
            )}

            {budgetMinor ? (
              <div className="rounded-xl bg-money-soft p-3.5">
                <p className="text-sm">
                  A hustler receives{' '}
                  <strong className="text-money">
                    {formatMoney(budgetMinor - Math.floor(budgetMinor * 0.1))}
                  </strong>{' '}
                  after the 10% platform fee.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 15000, 25000, 50000].map((amount) => (
                <Chip
                  key={amount}
                  size="sm"
                  selected={budgetMinor === toMinor(amount)}
                  onClick={() => update({ budgetInput: String(amount) })}
                >
                  {formatMoney(toMinor(amount), 'NGN', { compact: true })}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* ── 6. Requirements ──────────────────────────────────────────── */}
        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optional. Anything a hustler must have or be able to do.
            </p>
            <div className="flex flex-wrap gap-2">
              {REQUIREMENT_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  selected={draft.requirements.includes(preset)}
                  onClick={() =>
                    update({
                      requirements: draft.requirements.includes(preset)
                        ? draft.requirements.filter((item) => item !== preset)
                        : [...draft.requirements, preset],
                    })
                  }
                >
                  {preset}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. Visibility ────────────────────────────────────────────── */}
        {step === 7 && (
          <RadioGroup
            value={draft.visibility}
            onValueChange={(value) => update({ visibility: value as Draft['visibility'] })}
          >
            <RadioCard
              value="nearby"
              label="Hustlers near me"
              description="Recommended — reaches people who can actually get there"
              icon={<MapPin />}
            />
            <RadioCard
              value="category"
              label="Anyone in this category"
              description="Wider reach, including further away"
              icon={<Users />}
            />
          </RadioGroup>
        )}

        {/* ── 8. Review ────────────────────────────────────────────────── */}
        {step === 8 && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-medium leading-snug">{draft.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {draft.description}
              </p>

              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <Row label="Category" value={selectedCategory?.name ?? '—'} />
                <Row
                  label="Location"
                  value={draft.locationKind === 'remote' ? 'Remote' : locationLabel}
                />
                <Row
                  label="When"
                  value={
                    draft.scheduleKind === 'date' && draft.scheduledFor
                      ? new Date(draft.scheduledFor).toLocaleString('en-NG')
                      : { asap: 'As soon as possible', today: 'Today', tomorrow: 'Tomorrow', flexible: 'Flexible' }[
                          draft.scheduleKind as 'asap' | 'today' | 'tomorrow' | 'flexible'
                        ] ?? 'Flexible'
                  }
                />
                <Row
                  label="Budget"
                  value={
                    draft.budgetKind === 'negotiable'
                      ? 'Open to offers'
                      : `${formatMoney(budgetMinor)}${draft.budgetKind === 'hourly' ? '/hr' : ''}`
                  }
                />
                {draft.requirements.length > 0 && (
                  <Row label="Requirements" value={draft.requirements.join(', ')} />
                )}
              </dl>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive-soft p-3.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Posting is free. You only pay when you hire someone, and the money is held securely
              until you confirm the job is done.
            </p>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-4 md:left-64 xl:left-72"
        style={{ paddingBottom: 'calc(1rem + var(--safe-bottom) + var(--bottom-nav-height))' }}
      >
        <div className="mx-auto flex max-w-xl gap-2">
          {isLastStep ? (
            <Button size="lg" block loading={submitting} onClick={() => void publish()}>
              <Check aria-hidden="true" />
              Publish job
            </Button>
          ) : (
            <Button
              size="lg"
              block
              disabled={!stepValid}
              onClick={() => setStep((value) => value + 1)}
            >
              Continue
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
