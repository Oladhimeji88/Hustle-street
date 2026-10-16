#!/usr/bin/env tsx
/**
 * Development seed data.
 *
 * Creates a realistic Lagos marketplace: real neighbourhoods, real coordinates,
 * Nigerian names, and prices that reflect what these jobs actually cost. A
 * marketplace seeded with "Test User 1" and "$100" teaches you nothing about
 * whether the product works.
 *
 * SAFETY: refuses to run when NEXT_PUBLIC_APP_ENV is production. Seed data
 * must never reach real users (brief §45).
 *
 *   pnpm db:seed
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })
config({ path: '.env' })

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'development'

if (APP_ENV === 'production') {
  console.error('✗ Refusing to seed a production environment.')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Everyone shares this password so any seeded account is easy to log into. */
const SEED_PASSWORD = 'HustleStreet2026!'

const LAGOS_AREAS = [
  { name: 'Lekki Phase 1', lat: 6.4433, lng: 3.4736, city: 'Lagos Island' },
  { name: 'Victoria Island', lat: 6.4281, lng: 3.4219, city: 'Lagos Island' },
  { name: 'Ikoyi', lat: 6.453, lng: 3.435, city: 'Lagos Island' },
  { name: 'Ajah', lat: 6.4698, lng: 3.5852, city: 'Lagos Island' },
  { name: 'Ikeja', lat: 6.6018, lng: 3.3515, city: 'Lagos Mainland' },
  { name: 'Yaba', lat: 6.5095, lng: 3.3711, city: 'Lagos Mainland' },
  { name: 'Surulere', lat: 6.4931, lng: 3.351, city: 'Lagos Mainland' },
  { name: 'Gbagada', lat: 6.5546, lng: 3.389, city: 'Lagos Mainland' },
  { name: 'Magodo', lat: 6.618, lng: 3.38, city: 'Lagos Mainland' },
  { name: 'Festac Town', lat: 6.465, lng: 3.285, city: 'Lagos Mainland' },
]

const HUSTLERS = [
  { name: 'Daniel Okafor', username: 'danielokafor', headline: 'Graphic Designer', category: 'design', skills: ['graphic-design', 'branding', 'flyer-design', 'social-media-design'], rate: 25_000_00, area: 0, bio: 'Branding and social media design for small businesses. 6 years in, mostly restaurants and fashion brands.' },
  { name: 'Chiamaka Nwosu', username: 'chiamakan', headline: 'Professional Cleaner', category: 'cleaning', skills: ['house-cleaning', 'deep-cleaning', 'office-cleaning'], rate: 12_000_00, area: 4, bio: 'Deep cleaning for homes and offices. I bring my own supplies and I am never late.' },
  { name: 'Ibrahim Musa', username: 'ibrahimfix', headline: 'Plumber & Handyman', category: 'repairs', skills: ['plumbing', 'appliance-repair', 'furniture-assembly'], rate: 15_000_00, area: 5, bio: 'Plumbing, taps, pumps, leaks. Emergency call-outs across the mainland.' },
  { name: 'Blessing Adeyemi', username: 'blessingmua', headline: 'Makeup Artist', category: 'beauty', skills: ['makeup', 'gele'], rate: 35_000_00, area: 1, bio: 'Bridal and event makeup. Gele tying included. I come to you.' },
  { name: 'Tunde Bakare', username: 'tundemoves', headline: 'Moving & Dispatch', category: 'moving', skills: ['furniture-moving', 'loading', 'dispatch-rider'], rate: 20_000_00, area: 6, bio: 'I have my own truck. Furniture, relocations, market runs. Two extra hands available.' },
  { name: 'Ngozi Eze', username: 'ngozicodes', headline: 'Web Developer', category: 'tech', skills: ['web-development', 'mobile-development', 'it-support'], rate: 80_000_00, area: 5, bio: 'React and Next.js. I build and ship. Remote or on-site in Lagos.' },
  { name: 'Emeka Obi', username: 'emekashots', headline: 'Event Photographer', category: 'photography', skills: ['event-photography', 'portrait-photography', 'video-editing'], rate: 60_000_00, area: 2, bio: 'Weddings, birthdays, corporate. Same-week delivery of edited photos.' },
  { name: 'Fatima Bello', username: 'fatimatutors', headline: 'Maths & Physics Tutor', category: 'tutoring', skills: ['maths-tutoring', 'exam-prep'], rate: 10_000_00, area: 8, bio: 'WAEC and JAMB prep. I have taken 40+ students through it.' },
  { name: 'Segun Adebayo', username: 'segunwires', headline: 'Electrician', category: 'repairs', skills: ['electrical', 'generator-repair', 'cctv-installation'], rate: 18_000_00, area: 3, bio: 'Wiring, sockets, generators, CCTV. Certified and insured.' },
  { name: 'Amara Okonkwo', username: 'amaraevents', headline: 'Event Planner & Usher', category: 'events', skills: ['ushering', 'event-setup', 'decoration'], rate: 30_000_00, area: 1, bio: 'Full event setup and trained ushers. I bring a team of six.' },
  { name: 'Yusuf Aliyu', username: 'yusufrides', headline: 'Dispatch Rider', category: 'delivery', skills: ['dispatch-rider', 'courier'], rate: 5_000_00, area: 7, bio: 'Same-day dispatch across Lagos. Fragile items handled carefully.' },
  { name: 'Adaeze Nnamdi', username: 'adaezecooks', headline: 'Private Chef', category: 'home-services', skills: ['cooking', 'catering'], rate: 40_000_00, area: 0, bio: 'Nigerian and continental. Meal prep, dinner parties, small events.' },
]

const POSTERS = [
  { name: 'Kemi Alabi', username: 'kemialabi', area: 0 },
  { name: 'Uche Nwankwo', username: 'uchenwankwo', area: 4 },
  { name: 'Zainab Sani', username: 'zainabsani', area: 1 },
  { name: 'Femi Ogundipe', username: 'femiogundipe', area: 5 },
  { name: 'Grace Etim', username: 'graceetim', area: 3 },
  { name: 'Bola Ajayi', username: 'bolaajayi', area: 6 },
]

const JOB_TEMPLATES = [
  { title: 'Help move a sofa and two wardrobes', description: 'Moving from a 2nd floor flat to a house 15 minutes away. Need two strong people and ideally a vehicle. Should take about 3 hours.', category: 'moving', budget: 25_000_00, urgency: 'today' as const, schedule: 'today' as const },
  { title: 'Deep clean a 3-bedroom apartment', description: 'Just finished renovation, place needs a proper deep clean before we move in. Kitchen, bathrooms, all floors and windows. Cleaning supplies can be provided.', category: 'cleaning', budget: 35_000_00, urgency: 'scheduled' as const, schedule: 'date' as const },
  { title: 'Urgent: kitchen tap is leaking badly', description: 'The tap under the kitchen sink has been leaking since this morning and it is getting worse. Need a plumber today please.', category: 'repairs', budget: 15_000_00, urgency: 'asap' as const, schedule: 'asap' as const },
  { title: 'Design a flyer for my restaurant opening', description: 'Opening a small restaurant in Lekki next month. Need a flyer for Instagram and WhatsApp, plus a simple logo if possible. I have photos and the brand colours.', category: 'design', budget: 45_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
  { title: 'Photographer for a 30th birthday party', description: 'Saturday evening, about 60 guests, indoor venue in VI. Need around 4 hours of coverage and edited photos within a week.', category: 'photography', budget: 120_000_00, urgency: 'scheduled' as const, schedule: 'date' as const },
  { title: 'Makeup artist for a traditional wedding', description: 'Bridal makeup plus gele for me and two bridesmaids. Ceremony starts 11am so we would need you from about 7am.', category: 'beauty', budget: 90_000_00, urgency: 'scheduled' as const, schedule: 'date' as const },
  { title: 'Set up Wi-Fi and CCTV in a small office', description: 'New office, 6 desks. Need the router positioned properly, cabling tidied and 4 CCTV cameras installed and configured on my phone.', category: 'tech', budget: 85_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
  { title: 'Assemble a new wardrobe and desk', description: 'Flat-pack furniture from a store, still boxed. Instructions are included but I do not have the tools or the patience.', category: 'repairs', budget: 18_000_00, urgency: 'today' as const, schedule: 'today' as const },
  { title: 'Pick up an item from Lekki Phase 1', description: 'Small package, needs collecting from a shop in Lekki Phase 1 and delivering to Yaba. Item is fragile so please handle carefully.', category: 'delivery', budget: 8_000_00, urgency: 'asap' as const, schedule: 'asap' as const },
  { title: 'Maths tutor for SS2 student, twice a week', description: 'My son is struggling with maths ahead of WAEC. Looking for someone patient who can come twice a week, evenings, for the next few months.', category: 'tutoring', budget: 30_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
  { title: 'Wash and detail my car at home', description: 'Toyota Camry, needs a proper wash inside and out. I am home most of Saturday.', category: 'home-services', budget: 12_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
  { title: 'Build a landing page for my business', description: 'Small consulting business, need a clean one-page site with a contact form. I have the copy and logo already. Remote is fine.', category: 'tech', budget: 250_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
  { title: 'Ushers needed for a corporate event', description: 'Need 4 trained ushers for a product launch. Smart dress, 6 hours, Friday afternoon in VI.', category: 'events', budget: 80_000_00, urgency: 'scheduled' as const, schedule: 'date' as const },
  { title: 'Repair my generator, it will not start', description: 'Small 3.5KVA generator, was working fine last week. Now it turns but does not catch. Probably needs servicing.', category: 'repairs', budget: 22_000_00, urgency: 'today' as const, schedule: 'today' as const },
  { title: 'Social media manager for a fashion brand', description: 'Need someone to run Instagram and TikTok for a small fashion label. Content planning, posting, and replying to DMs. Ongoing, remote.', category: 'digital-services', budget: 150_000_00, urgency: 'flexible' as const, schedule: 'flexible' as const },
]

const REVIEW_BODIES = [
  'Turned up on time and did exactly what we agreed. Would use again.',
  'Very professional. Communicated clearly the whole way through.',
  'Great work, finished faster than expected. Highly recommend.',
  'Good job overall. Small delay at the start but sorted it out.',
  'Excellent. Cleaned up afterwards without being asked.',
  'Knew exactly what to do. Fair price for the quality.',
]

function jitter(value: number, amount = 0.008) {
  return value + (Math.random() - 0.5) * amount
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

async function ensureUser(email: string, metadata: Record<string, unknown>) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error) {
    // Already exists from a previous run — look it up instead.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const existing = list?.users.find((candidate) => candidate.email === email)
    if (existing) return existing.id
    throw error
  }

  return data.user!.id
}

/*
 * Direct PostgreSQL connection.
 *
 * The escrow RPCs authorise against app.current_user_id(), which reads
 * request.jwt.claim.sub. The service-role REST client has no subject, so the
 * seed impersonates each party over a plain connection instead.
 */
const sql_client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await sql_client.connect()
  console.log(`→ seeding ${APP_ENV} environment\n`)

  const { data: categories } = await admin.from('categories').select('id, slug')
  const { data: skills } = await admin.from('skills').select('id, slug')

  if (!categories?.length) {
    console.error('✗ No categories found. Run `pnpm db:migrate` first.')
    process.exit(1)
  }

  const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]))
  const skillBySlug = new Map((skills ?? []).map((row) => [row.slug, row.id]))

  // ── Hustlers ────────────────────────────────────────────────────────────
  console.log('→ creating hustlers')
  const hustlerIds: string[] = []

  for (const person of HUSTLERS) {
    const area = LAGOS_AREAS[person.area]!
    const email = `${person.username}@seed.hustlestreet.test`
    const userId = await ensureUser(email, { display_name: person.name })

    await admin.from('profiles').upsert({
      id: userId,
      username: person.username,
      display_name: person.name,
      email,
      headline: person.headline,
      bio: person.bio,
      city: area.city,
      area: area.name,
      state: 'Lagos',
      country_code: 'NG',
      home_lat: jitter(area.lat),
      home_lng: jitter(area.lng),
      is_hustler: true,
      is_poster: true,
      service_radius_km: 10 + Math.floor(Math.random() * 20),
      starting_price_minor: person.rate,
      available_now: Math.random() > 0.45,
      accepts_remote: ['design', 'tech', 'digital-services'].includes(person.category),
      profile_completed: true,
      onboarding_step: 'done',
      email_verified: true,
      phone_verified: Math.random() > 0.3,
      identity_verified: Math.random() > 0.5,
    })

    await admin.from('notification_preferences').upsert({ user_id: userId })

    const skillRows = person.skills
      .map((slug) => skillBySlug.get(slug))
      .filter(Boolean)
      .map((skillId, index) => ({
        user_id: userId,
        skill_id: skillId as string,
        is_primary: index === 0,
        years_experience: 1 + Math.floor(Math.random() * 8),
      }))

    if (skillRows.length) await admin.from('user_skills').upsert(skillRows)

    hustlerIds.push(userId)
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${hustlerIds.length} hustlers`)

  // ── Posters ─────────────────────────────────────────────────────────────
  console.log('→ creating job posters')
  const posterIds: string[] = []

  for (const person of POSTERS) {
    const area = LAGOS_AREAS[person.area]!
    const email = `${person.username}@seed.hustlestreet.test`
    const userId = await ensureUser(email, { display_name: person.name })

    await admin.from('profiles').upsert({
      id: userId,
      username: person.username,
      display_name: person.name,
      email,
      city: area.city,
      area: area.name,
      state: 'Lagos',
      country_code: 'NG',
      home_lat: jitter(area.lat),
      home_lng: jitter(area.lng),
      is_hustler: false,
      is_poster: true,
      profile_completed: true,
      onboarding_step: 'done',
      email_verified: true,
      phone_verified: true,
      identity_verified: Math.random() > 0.4,
    })

    await admin.from('notification_preferences').upsert({ user_id: userId })
    posterIds.push(userId)
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${posterIds.length} posters`)

  // ── An admin account ────────────────────────────────────────────────────
  const adminId = await ensureUser('admin@seed.hustlestreet.test', { display_name: 'Platform Admin' })
  await admin.from('profiles').upsert({
    id: adminId,
    username: 'platformadmin',
    display_name: 'Platform Admin',
    email: 'admin@seed.hustlestreet.test',
    city: 'Lagos Island',
    area: 'Victoria Island',
    state: 'Lagos',
    home_lat: 6.4281,
    home_lng: 3.4219,
    is_hustler: false,
    is_poster: true,
    profile_completed: true,
    onboarding_step: 'done',
    email_verified: true,
  })
  await admin.from('notification_preferences').upsert({ user_id: adminId })
  await admin.from('user_roles').upsert({ user_id: adminId, role: 'superadmin' })
  console.log('  ✓ admin account (superadmin)')

  // ── Jobs ────────────────────────────────────────────────────────────────
  console.log('→ posting jobs')
  const jobIds: string[] = []

  for (let index = 0; index < JOB_TEMPLATES.length * 2; index++) {
    const template = JOB_TEMPLATES[index % JOB_TEMPLATES.length]!
    const posterId = pick(posterIds)
    const area = pick(LAGOS_AREAS)
    const categoryId = categoryBySlug.get(template.category)
    if (!categoryId) continue

    const isRemote = ['tech', 'design', 'digital-services'].includes(template.category) && Math.random() > 0.6
    const publishedAt = new Date(Date.now() - Math.random() * 12 * 86_400_000)

    const { data: job } = await admin
      .from('jobs')
      .insert({
        poster_id: posterId,
        category_id: categoryId,
        title: template.title,
        description: template.description,
        status: 'APPLICATIONS_OPEN',
        urgency: template.urgency,
        location_kind: isRemote ? 'remote' : 'onsite',
        visibility: 'nearby',
        exact_lat: isRemote ? null : jitter(area.lat),
        exact_lng: isRemote ? null : jitter(area.lng),
        area_label: isRemote ? null : area.name,
        city: area.city,
        state: 'Lagos',
        schedule_kind: template.schedule,
        scheduled_for:
          template.schedule === 'date'
            ? new Date(Date.now() + (2 + Math.random() * 10) * 86_400_000).toISOString()
            : null,
        budget_kind: 'fixed',
        budget_min_minor: template.budget,
        currency: 'NGN',
        published_at: publishedAt.toISOString(),
        expires_at: new Date(publishedAt.getTime() + 30 * 86_400_000).toISOString(),
      })
      .select('id')
      .single()

    if (job) {
      jobIds.push(job.id)
      process.stdout.write('.')
    }
  }
  console.log(`\n  ✓ ${jobIds.length} jobs`)

  // ── Applications ────────────────────────────────────────────────────────
  console.log('→ submitting applications')
  let applicationCount = 0

  for (const jobId of jobIds) {
    const { data: job } = await admin
      .from('jobs')
      .select('poster_id, budget_min_minor, currency')
      .eq('id', jobId)
      .single()

    if (!job) continue

    const applicantCount = Math.floor(Math.random() * 5)
    const applicants = [...hustlerIds].sort(() => Math.random() - 0.5).slice(0, applicantCount)

    for (const hustlerId of applicants) {
      if (hustlerId === job.poster_id) continue

      // ±20% around the asking price — how people actually negotiate.
      const offered = Math.round((job.budget_min_minor ?? 1000000) * (0.8 + Math.random() * 0.4))

      const { error } = await admin.from('job_applications').insert({
        job_id: jobId,
        hustler_id: hustlerId,
        proposed_price_minor: offered,
        currency: job.currency,
        message: pick([
          'I can handle this today. I have done several jobs like it and I will come with my own tools.',
          'Available and interested. I work in this area regularly so I can be there quickly.',
          'I have 5 years experience with exactly this kind of work. Happy to discuss the details first.',
          'I can start whenever suits you. Let me know the time and I will be there.',
        ]),
        estimated_minutes: 60 + Math.floor(Math.random() * 300),
      })

      if (!error) applicationCount += 1
    }
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${applicationCount} applications`)

  // ── A few completed jobs, so reviews and ratings are real ──────────────
  console.log('→ completing a few jobs end to end')
  let completed = 0

  for (const jobId of jobIds.slice(0, 8)) {
    const { data: application } = await admin
      .from('job_applications')
      .select('id, hustler_id, proposed_price_minor, currency, job_id')
      .eq('job_id', jobId)
      .limit(1)
      .maybeSingle()

    if (!application) continue

    const { data: job } = await admin.from('jobs').select('poster_id').eq('id', jobId).single()
    if (!job) continue

    /*
     * Drive the REAL money pipeline rather than inserting a completed
     * assignment. Writing `status: 'completed'` directly would produce seed
     * data that looks right on screen while the escrow, the double-entry
     * ledger and the commission split had never executed — precisely the kind
     * of fake functionality that hides bugs until production.
     *
     * The four calls below are the same ones the API routes make:
     *   accept_application     poster hires, escrow transaction created
     *   record_escrow_funding  what the verified Paystack webhook invokes
     *   submit_job_completion  hustler marks the work done
     *   confirm_job_completion poster confirms, ledger posts the release
     *
     * `request.jwt.claim.sub` is set per call because those RPCs authorise
     * against app.current_user_id(); the service-role REST client has no
     * subject and would be rejected with "Authentication required".
     */
    const assignment = await (async () => {
      const asUser = async (userId: string, sql: string, params: unknown[] = []) => {
        await sql_client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId])
        return sql_client.query(sql, params)
      }

      try {
        const hired = await asUser(job.poster_id, 'select * from accept_application($1)', [
          application.id,
        ])
        const { assignment_id, transaction_id } = hired.rows[0]

        // Stand in for the payment provider confirming the charge.
        await sql_client.query(`select set_config('request.jwt.claim.sub', '', false)`)
        await sql_client.query('select record_escrow_funding($1, $2, $3, $4)', [
          transaction_id,
          `seed_${transaction_id.slice(0, 8)}`,
          0,
          null,
        ])

        await asUser(application.hustler_id, 'select submit_job_completion($1, $2, $3)', [
          assignment_id,
          'All done — please take a look.',
          [],
        ])

        await asUser(job.poster_id, 'select * from confirm_job_completion($1, false)', [
          assignment_id,
        ])

        return { id: assignment_id as string }
      } catch (error) {
        console.warn(`\n  ! money pipeline failed for job ${jobId}:`,
          error instanceof Error ? error.message : error)
        return null
      }
    })()

    if (!assignment) continue

    // Both directions, so the double-blind publish trigger fires.
    await admin.from('reviews').insert([
      {
        assignment_id: assignment.id,
        job_id: jobId,
        reviewer_id: job.poster_id,
        reviewee_id: application.hustler_id,
        direction: 'poster_to_hustler',
        rating: 4 + Math.round(Math.random()),
        body: pick(REVIEW_BODIES),
        quality: 4 + Math.round(Math.random()),
        communication: 4 + Math.round(Math.random()),
        reliability: 4 + Math.round(Math.random()),
        professionalism: 4 + Math.round(Math.random()),
      },
      {
        assignment_id: assignment.id,
        job_id: jobId,
        reviewer_id: application.hustler_id,
        reviewee_id: job.poster_id,
        direction: 'hustler_to_poster',
        rating: 4 + Math.round(Math.random()),
        body: pick(['Clear brief and paid straight away.', 'Easy to work with, would take another job from them.']),
        communication: 5,
        payment_promptness: 5,
        respect: 5,
        job_accuracy: 4 + Math.round(Math.random()),
      },
    ])

    completed += 1
    process.stdout.write('.')
  }
  console.log(`\n  ✓ ${completed} completed jobs with reviews`)

  console.log('\n✓ seed complete\n')
  console.log('  Log in with any of these:')
  console.log(`    admin@seed.hustlestreet.test        (superadmin)`)
  console.log(`    danielokafor@seed.hustlestreet.test (hustler)`)
  console.log(`    kemialabi@seed.hustlestreet.test    (poster)`)
  console.log(`  Password: ${SEED_PASSWORD}\n`)
}

main().finally(() => sql_client.end().catch(() => {})).catch((error) => {
  console.error('\n✗ seed failed')
  console.error(error)
  process.exit(1)
})
