'use client'

import Link from 'next/link'
import { CATEGORY_EMOJI } from './job-card'
import { ChipRail } from '@/components/ui/chip'
import type { Category } from '@/types/database'

type CategorySummary = Pick<Category, 'id' | 'slug' | 'name' | 'icon' | 'job_count'>

/** Horizontally scrolling category picker. Real categories, real job counts. */
export function CategoryRail({ categories }: { categories: CategorySummary[] }) {
  if (categories.length === 0) return null

  return (
    <ChipRail ariaLabel="Job categories">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/discover?categories=${category.id}`}
          className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft"
        >
          <span className="text-2xl" aria-hidden="true">
            {CATEGORY_EMOJI[category.slug] ?? '🛠️'}
          </span>
          <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
            {category.name}
          </span>
          {category.job_count > 0 && (
            <span className="text-[10px] text-muted-foreground">{category.job_count}</span>
          )}
        </Link>
      ))}
    </ChipRail>
  )
}
