import type { VideoSource } from '@/components/media/video-player'

/**
 * Landing page media manifest.
 *
 * Kept as data rather than scattered through JSX so swapping a placeholder for
 * real footage is a one-line edit here, and so the whole asset inventory is
 * visible in one place when briefing a photographer or editor.
 *
 * `sources` is empty until real files exist. The player renders the poster with
 * an honest "Film coming soon" state rather than a play button that does
 * nothing — see `VideoPlayer`.
 *
 * ── To add a real video ─────────────────────────────────────────────────────
 * 1. Encode two versions. WebM (VP9) first, MP4 (H.264) as the fallback for
 *    Safari. Target ~1.5 Mbps at 1080p — our users pay for their data.
 * 2. Drop them in `public/media/`.
 * 3. Export captions from your editor as WebVTT to `public/media/captions/`.
 * 4. Fill in `sources` and `captionsSrc` below.
 *
 * Captions are not optional. Most people watch social video muted, and a video
 * without them is unusable for anyone deaf or hard of hearing.
 */

export interface LandingVideo {
  id: string
  title: string
  description: string
  poster: string
  duration: string
  sources: VideoSource[]
  captionsSrc?: string
  transcript?: string
}

export const HERO_VIDEO: LandingVideo = {
  id: 'how-it-works',
  title: 'How Hustle Street works',
  description:
    'A job posted in Lekki, three applications in nine minutes, and money released the moment the work was confirmed.',
  poster: '/media/poster-how-it-works.png',
  duration: '1:48',
  sources: [],
  transcript: `Kemi needs a sofa moved from a second-floor flat in Lekki. She opens Hustle Street and describes the job — two minutes, no forms, no phone calls.

Within nine minutes, three hustlers nearby have applied. She can see their ratings, how many jobs they have completed, how far away they are, and what each one is asking.

She picks Tunde. He has done 47 moves and he has his own truck.

She pays. The money does not go to Tunde — it is held securely until the job is done. Both of them can see that it is held.

Tunde arrives at four. The job takes two hours. He marks it done in the app.

Kemi confirms. The money is released immediately, minus the platform fee. Tunde withdraws it to his bank account the same evening.

Then they review each other. Neither review is visible until both have been submitted.`,
}

export const ESCROW_VIDEO: LandingVideo = {
  id: 'escrow',
  title: 'Your money, held safely',
  description:
    'What actually happens between hiring someone and paying them — and what happens if something goes wrong.',
  poster: '/media/poster-escrow.png',
  duration: '2:12',
  sources: [],
  transcript: `The hardest part of hiring a stranger is trust. Both sides have the same fear: the poster worries about paying for work that never happens, and the hustler worries about doing work that never gets paid for.

So the money moves in a specific order.

When you hire someone, you pay before the work starts. That payment does not reach the hustler. It is held by our licensed payment provider — not by Hustle Street, and not by the person you hired. Both of you see that it is secured.

The hustler starts work knowing the money is already there.

When the job is done, they mark it complete. You confirm, and the money is released — minus the platform fee.

If you never confirm, it releases automatically after seventy-two hours. That is deliberate: a hustler should not be able to lose their earnings because someone stopped replying.

If something genuinely went wrong, do not confirm. Open a dispute instead. The money stays held while a real person reviews the messages, the photos and the evidence from both sides. They can refund you fully, release fully, or split it.

Every naira is tracked in an auditable ledger. Nothing is ever adjusted by hand.`,
}

export interface HustlerStory {
  id: string
  name: string
  trade: string
  area: string
  quote: string
  poster: string
  duration: string
  sources: VideoSource[]
}

/**
 * Hustler stories.
 *
 * These carry more weight than any feature copy on the page: a real person
 * saying what changed for them is the entire trust argument. Prioritise
 * replacing these placeholders first.
 *
 * The quotes below are illustrative and MUST be replaced with real, consented
 * testimonials before launch — inventing a quote and attributing it to a named
 * person is not something to ship.
 */
export const HUSTLER_STORIES: HustlerStory[] = [
  {
    id: 'blessing',
    name: 'Blessing Adeyemi',
    trade: 'Makeup Artist',
    area: 'Victoria Island',
    quote:
      'I used to chase people for balance payments after every job. Now the money is already there before I pick up a brush.',
    poster: '/media/story-blessing.png',
    duration: '0:52',
    sources: [],
  },
  {
    id: 'ibrahim',
    name: 'Ibrahim Musa',
    trade: 'Plumber',
    area: 'Yaba',
    quote:
      'Most of my work came from one estate. Now I get jobs from three areas I had never worked in, and they come to me.',
    poster: '/media/story-ibrahim.png',
    duration: '1:04',
    sources: [],
  },
  {
    id: 'ngozi',
    name: 'Ngozi Eze',
    trade: 'Web Developer',
    area: 'Ikeja',
    quote:
      'The remote jobs mean I am not limited to who I know. My rating did the introduction for me.',
    poster: '/media/story-ngozi.png',
    duration: '0:47',
    sources: [],
  },
]

/** Still imagery used across the marketing sections. */
export const SCENES = {
  post: '/media/scene-post.png',
  hustlers: '/media/scene-hustlers.png',
  payment: '/media/scene-payment.png',
  categories: '/media/scene-categories.png',
  coverage: '/media/coverage-lagos.png',
} as const

/** App screenshots, regenerated from the real UI by `pnpm media`. */
export const APP_SHOTS = {
  home: '/media/app-home.png',
  discover: '/media/app-discover.png',
  chat: '/media/app-chat.png',
} as const
