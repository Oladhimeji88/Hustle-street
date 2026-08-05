import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Bell, Briefcase, Plus, Search, Users } from 'lucide-react'
import { createClient, getCurrentProfile } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { SectionHeader } from '@/components/ui/card'
import { CategoryRail } from '@/components/job/category-rail'
import { NearbyJobsFeed } from '@/components/job/nearby-jobs-feed'
import { RecommendedJobs } from '@/components/job/recommended-jobs'
import { ActiveWorkStrip } from '@/components/job/active-work-strip'
import { LocationBar } from '@/components/location/location-bar'
import type { Category } from '@/types/database'

export const metadata: Metadata = { title: 'Home' }
export const dynamic = 'force-dynamic'

/**
 * Home.
 *
 * The brief's core principle: within a second of opening the app a person
 * should know they can either say what they need, or find work. So the hero is
 * a question and two buttons — not a dashboard of statistics.
 *
 * Everything below adapts to who is looking: an active job in flight outranks
 * everything, then recommendations for hustlers, then nearby jobs for everyone.
 */
export default async function HomePage() {
  const profile = await getCurrentProfile()
  const supabase = await createClient()

  const [{ data: categories }, { count: unreadNotifications }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, icon, job_count')
      .eq('is_active', true)
      .is('parent_id', null)
      .order('position')
      .limit(15),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile!.id)
      .is('read_at', null),
  ])

  const firstName = profile!.display_name.split(' ')[0]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-4 sm:px-6 lg:max-w-5xl">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3">
        <Link href="/profile" className="flex min-w-0 items-center gap-3 rounded-xl">
          <Avatar
            src={profile!.avatar_url}
            name={profile!.display_name}
            seed={profile!.id}
            size="md"
            online={profile!.available_now}
          />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Welcome back</span>
            <span className="block truncate font-display text-base font-bold">{firstName}</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
            className="relative flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-secondary"
          >
            <Bell className="size-5" aria-hidden="true" />
            {(unreadNotifications ?? 0) > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadNotifications! > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="mt-3">
        <LocationBar />
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mt-5" aria-labelledby="home-hero">
        <h1 id="home-hero" className="text-display-sm">
          What do you need done?
        </h1>

        <Link
          href="/discover"
          className="mt-3 flex h-14 items-center gap-3 rounded-2xl border border-input bg-surface px-4 text-muted-foreground transition-colors hover:border-primary/40"
        >
          <Search className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate text-[15px]">Search for a job, service or skill…</span>
        </Link>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <QuickAction href="/post" icon={<Plus />} label="Post a Job" primary />
          <QuickAction href="/discover?mode=jobs" icon={<Briefcase />} label="Find Work" />
          <QuickAction href="/discover?mode=hustlers" icon={<Users />} label="Hustlers" />
        </div>
      </section>

      {/* ── Anything in flight comes first ──────────────────────────────── */}
      <ActiveWorkStrip userId={profile!.id} />

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="home-categories">
        <SectionHeader
          title={<span id="home-categories">Browse by category</span>}
          action={
            <Button asChild variant="ghost" size="xs">
              <Link href="/categories">
                All
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <CategoryRail
          categories={
            (categories ?? []) as Pick<Category, 'id' | 'slug' | 'name' | 'icon' | 'job_count'>[]
          }
        />
      </section>

      {/* ── Recommendations, only for hustlers ──────────────────────────── */}
      {profile!.is_hustler && (
        <section className="mt-8" aria-labelledby="home-recommended">
          <SectionHeader
            title={<span id="home-recommended">Picked for you</span>}
            subtitle="Based on your skills, location and availability"
          />
          <RecommendedJobs />
        </section>
      )}

      {/* ── Nearby ──────────────────────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="home-nearby">
        <SectionHeader
          title={<span id="home-nearby">Jobs near you</span>}
          action={
            <Button asChild variant="ghost" size="xs">
              <Link href="/discover">
                See all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <NearbyJobsFeed />
      </section>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  label,
  primary,
}: {
  href: string
  icon: React.ReactNode
  label: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'flex flex-col items-center gap-1.5 rounded-2xl bg-primary p-3.5 text-primary-foreground shadow-street transition-transform active:scale-[0.98] [&_svg]:size-5'
          : 'flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-primary/40 hover:bg-primary-soft [&_svg]:size-5'
      }
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  )
}
