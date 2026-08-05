import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/locations — area autocomplete for the location picker.
 *
 * Backed by our own curated `locations` table rather than a third-party
 * geocoder: results are consistent, free, work offline-ish via cache, and only
 * ever return places we actually operate in.
 */
export const GET = defineRoute(
  {
    auth: 'none',
    querySchema: z.object({
      q: z.string().trim().min(1).max(80),
      kind: z.enum(['area', 'city', 'state']).optional(),
    }),
    rateLimit: 'search',
    name: 'GET /api/locations',
  },
  async ({ query, supabase }) => {
    let builder = supabase
      .from('locations')
      .select('id, name, kind, lat, lng, parent:locations!locations_parent_id_fkey(name)')
      .eq('is_active', true)
      .not('lat', 'is', null)
      .ilike('name', `%${query.q}%`)
      .order('kind')
      .limit(12)

    if (query.kind) builder = builder.eq('kind', query.kind)

    const { data, error } = await builder
    if (error) throw error

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        lat: row.lat,
        lng: row.lng,
        parent: (row.parent as unknown as { name: string } | null)?.name ?? null,
      })),
    )
  },
)
