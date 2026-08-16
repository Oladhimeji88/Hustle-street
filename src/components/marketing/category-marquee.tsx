'use client'

import * as React from 'react'
import Link from 'next/link'
import { categoryIcon } from '@/lib/categories'
import type { Category } from '@/types/database'

type CategoryRow = Pick<Category, 'id' | 'slug' | 'name' | 'icon' | 'job_count'>

/**
 * Continuously scrolling category rail.
 *
 * ── Why CSS and not Motion ──────────────────────────────────────────────────
 *
 * Everything else on this page animates through Motion, but a marquee is the
 * one case where that would be the wrong call. Motion drives values from
 * JavaScript on every frame; an infinite loop means doing that forever, on a
 * page that is otherwise idle, on the mid-range Android phones that make up
 * most of this market. A CSS keyframe on `transform` runs on the compositor and
 * costs the main thread nothing once started.
 *
 * ── How the seam is hidden ──────────────────────────────────────────────────
 *
 * The track holds the list twice and translates by exactly -50%. At that point
 * copy 2 sits precisely where copy 1 started, so resetting to 0 is invisible.
 * This is why the duplicate is required rather than merely nice: without it the
 * track would run out of content and visibly snap back.
 *
 * The second copy is `aria-hidden` and its links are removed from the tab order
 * — visually it is the same rail continuing, but to a screen reader or a
 * keyboard it would be fifteen duplicate links with no way to tell them apart.
 *
 * Hovering pauses it, so the thing you are reaching for stops moving.
 */
export function CategoryMarquee({ categories }: { categories: CategoryRow[] }) {
  // Duration scales with the number of tiles so the pixels-per-second rate
  // stays constant regardless of how many categories come back from the DB.
  // Raised alongside the tile width — wider cards cover more ground per tile,
  // so the same per-tile duration would have sped the whole rail up.
  const seconds = Math.max(36, categories.length * 4.6)

  if (categories.length === 0) return null

  return (
    <div
      className="marquee relative -mx-4 overflow-hidden sm:-mx-6 lg:-mx-10"
      style={{ ['--marquee-duration' as string]: `${seconds}s` }}
    >
      {/* Feathered edges, so tiles enter and leave rather than being cut off by
          the viewport. Masked rather than gradient-overlaid so it works over
          whatever the section background happens to be. */}
      <div className="marquee-track flex w-max gap-2 py-1">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 gap-2" aria-hidden={copy === 1 || undefined}>
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon, category.slug)
              return (
                <li key={`${copy}-${category.id}`} className="w-[240px] shrink-0 sm:w-[288px]">
                  <Link
                    href={`/explore?categories=${category.id}`}
                    tabIndex={copy === 1 ? -1 : undefined}
                    className="lift group flex h-full flex-col rounded-md border border-border bg-surface p-7 hover:border-border-strong hover:bg-surface-muted"
                  >
                    <Icon className="icon-hover size-6 text-muted-foreground" aria-hidden="true" />
                    <span className="mt-14 font-display text-h6">
                      {category.name}
                    </span>
                    <span className="mt-1.5 font-mono text-eyebrow-sm tabular-nums text-muted-foreground">
                      {category.job_count > 0
                        ? `${category.job_count.toLocaleString()} live`
                        : 'Be the first'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </div>
  )
}
