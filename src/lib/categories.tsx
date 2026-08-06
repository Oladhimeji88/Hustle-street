import {
  Bike,
  Camera,
  CircleEllipsis,
  Globe,
  GraduationCap,
  HardHat,
  House,
  Laptop,
  Palette,
  PartyPopper,
  Scissors,
  ShoppingBag,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Category iconography.
 *
 * This used to be an emoji map living inside `job-card.tsx`. Two problems with
 * that, one functional and one editorial:
 *
 *   • It was exported from a `'use client'` module and consumed by a server
 *     component, so the lookup silently resolved to undefined and every tile
 *     rendered the same fallback glyph.
 *
 *   • Emoji are the wrong tool. They render differently on every platform,
 *     carry inconsistent visual weight, and mix metaphors — a broom next to a
 *     paint palette next to a motorbike reads as clip-art, not as a brand.
 *
 * The `categories.icon` column already stores a Lucide name (set in migration
 * 0014), so the database is the single source of truth and the UI just resolves
 * it. Unknown names degrade to a neutral mark rather than breaking the grid.
 */
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Wrench,
  Truck,
  Bike,
  Palette,
  Camera,
  Scissors,
  Laptop,
  PartyPopper,
  GraduationCap,
  HardHat,
  House,
  ShoppingBag,
  Globe,
  CircleEllipsis,
}

/** Fallback by slug, for categories created before an icon was chosen. */
const BY_SLUG: Record<string, LucideIcon> = {
  cleaning: Sparkles,
  repairs: Wrench,
  moving: Truck,
  delivery: Bike,
  design: Palette,
  photography: Camera,
  beauty: Scissors,
  tech: Laptop,
  events: PartyPopper,
  tutoring: GraduationCap,
  construction: HardHat,
  'home-services': House,
  errands: ShoppingBag,
  'digital-services': Globe,
  other: CircleEllipsis,
}

export function categoryIcon(icon?: string | null, slug?: string | null): LucideIcon {
  return (icon ? ICONS[icon] : undefined) ?? (slug ? BY_SLUG[slug] : undefined) ?? CircleEllipsis
}

/**
 * Per-category accent, used as a tint behind the icon.
 *
 * Deliberately drawn from the brand's own three colours rather than fifteen
 * arbitrary hues — the grid should read as one system, with the category
 * providing rhythm rather than noise.
 */
const ACCENTS = [
  'bg-primary-soft text-primary',
  'bg-money-soft text-money',
  'bg-accent/10 text-accent',
  'bg-warning-soft text-warning-foreground',
] as const

export function categoryAccent(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}
