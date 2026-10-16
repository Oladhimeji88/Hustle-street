#!/usr/bin/env tsx
/**
 * Generates the landing page's visual assets.
 *
 *   pnpm media
 *
 * These are BRANDED PLACEHOLDERS, drawn as SVG and rasterised. They exist so
 * the page renders complete and on-brand before a photographer has been near
 * it — not as a substitute for real photography.
 *
 * The app screenshots are the exception: those are faithful renderings of the
 * real UI, so they stay useful even after photography lands.
 *
 * Replace, in priority order:
 *   1. media/story-*.jpg           real hustlers, real faces — the trust payload
 *   2. media/poster-*.png          real video poster frames
 *   3. media/scene-*.png           real Lagos photography
 *   4. media/app-*.png             regenerate from real screenshots when the UI moves
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = join(process.cwd(), 'public', 'media')

// Brand palette, mirroring globals.css. Keep these in step with the tokens —
// generated art that is one shade off reads as a different product.
const STREET = '#FF5229' // --primary
const STREET_SOFT = '#FFF0EB' // --primary-soft
const INK = '#151524' // --ink
const INK_2 = '#242433'
const PAPER = '#FBFBF8' // --background
// Panels sit at the same fill as the page in this system; they are told apart by
// their border, so SURFACE is no longer a lighter white.
const SURFACE = '#FBFBF8'
const MONEY = '#1F6B4C' // --money
const MONEY_SOFT = '#EAF6F0'
const MUTED = '#686873' // --muted-foreground
const BORDER = '#E4E3DE' // --border
const WARNING = '#FFAF01' // --sun
const TANGERINE = '#FF8204'
const AZURE = '#0082E6'

/* ── helpers ─────────────────────────────────────────────────────────────── */

const font = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`

function text(
  x: number,
  y: number,
  content: string,
  {
    size = 14,
    weight = 500,
    fill = INK,
    anchor = 'start',
    opacity = 1,
  }: { size?: number; weight?: number; fill?: string; anchor?: string; opacity?: number } = {},
) {
  const safe = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${safe}</text>`
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  { r = 0, fill = SURFACE, stroke = '', sw = 1, opacity = 1 } = {},
) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}"${
    stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
  }/>`
}

async function render(svg: string, file: string, width: number, height: number) {
  const buffer = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(join(OUT, file), buffer)
  console.log(`  ✓ ${file.padEnd(28)} ${width}×${height}`)
}

/* ── app screenshots ─────────────────────────────────────────────────────── */

const PHONE_W = 390
const PHONE_H = 844

/** A job card as it actually renders, at phone width. */
function jobCard(y: number, title: string, price: string, meta: string, emoji: string, urgent = false) {
  return `
    ${rect(16, y, PHONE_W - 32, 108, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${rect(30, y + 16, 56, 56, { r: 6, fill: STREET_SOFT })}
    ${text(58, y + 52, emoji, { size: 26, anchor: 'middle' })}
    ${text(98, y + 34, title, { size: 14, weight: 700 })}
    ${text(98, y + 58, price, { size: 17, weight: 600, fill: MONEY })}
    ${text(98, y + 80, meta, { size: 11, fill: MUTED })}
    ${
      urgent
        ? `${rect(PHONE_W - 78, y + 14, 48, 20, { r: 4, fill: '#FDE7EA' })}
           ${text(PHONE_W - 54, y + 28, 'ASAP', { size: 9, weight: 700, fill: '#C22B3E', anchor: 'middle' })}`
        : ''
    }`
}

function phoneChrome() {
  return `
    ${rect(0, 0, PHONE_W, PHONE_H, { fill: PAPER })}
    <!-- status bar -->
    ${text(24, 30, '9:41', { size: 13, weight: 700 })}
    ${rect(PHONE_W - 62, 20, 22, 11, { r: 3, fill: INK, opacity: 0.85 })}
    ${rect(PHONE_W - 86, 21, 16, 9, { r: 2, fill: INK, opacity: 0.55 })}`
}

function appHome() {
  const chips = ['Cleaning', 'Repairs', 'Moving', 'Design']
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W}" height="${PHONE_H}" viewBox="0 0 ${PHONE_W} ${PHONE_H}">
    ${phoneChrome()}

    <!-- header -->
    <circle cx="40" cy="76" r="20" fill="${STREET_SOFT}"/>
    ${text(40, 82, 'K', { size: 16, weight: 700, fill: '#8A3A00', anchor: 'middle' })}
    ${text(70, 70, 'Welcome back', { size: 11, fill: MUTED })}
    ${text(70, 88, 'Kemi', { size: 16, weight: 600 })}
    <circle cx="${PHONE_W - 36}" cy="76" r="16" fill="${SURFACE}" stroke="${BORDER}"/>
    <circle cx="${PHONE_W - 30}" cy="70" r="5" fill="${STREET}"/>

    <!-- location pill -->
    ${rect(20, 106, 168, 30, { r: 6, fill: SURFACE, stroke: BORDER })}
    <circle cx="38" cy="121" r="4" fill="${STREET}"/>
    ${text(50, 126, 'Lekki Phase 1', { size: 12, weight: 600 })}

    <!-- hero question -->
    ${text(20, 178, 'What do you need', { size: 25, weight: 600 })}
    ${text(20, 208, 'done?', { size: 25, weight: 600 })}

    <!-- search -->
    ${rect(20, 228, PHONE_W - 40, 52, { r: 6, fill: SURFACE, stroke: BORDER })}
    <circle cx="46" cy="254" r="7" fill="none" stroke="${MUTED}" stroke-width="2"/>
    <line x1="51" y1="259" x2="56" y2="264" stroke="${MUTED}" stroke-width="2" stroke-linecap="round"/>
    ${text(68, 259, 'Search for a job, service or skill…', { size: 12.5, fill: MUTED })}

    <!-- quick actions -->
    ${rect(20, 294, 110, 72, { r: 6, fill: STREET })}
    ${text(75, 330, '+', { size: 26, weight: 600, fill: '#fff', anchor: 'middle' })}
    ${text(75, 352, 'Post a Job', { size: 11, weight: 700, fill: '#fff', anchor: 'middle' })}
    ${rect(140, 294, 110, 72, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${text(195, 352, 'Find Work', { size: 11, weight: 700, anchor: 'middle' })}
    ${rect(260, 294, 110, 72, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${text(315, 352, 'Hustlers', { size: 11, weight: 700, anchor: 'middle' })}

    <!-- category chips -->
    ${chips
      .map((label, i) => {
        const x = 20 + i * 92
        return `${rect(x, 388, 84, 34, { r: 6, fill: SURFACE, stroke: BORDER })}
                ${text(x + 42, 410, label, { size: 11, weight: 600, anchor: 'middle' })}`
      })
      .join('')}

    <!-- section header -->
    ${text(20, 452, 'Jobs near you', { size: 18, weight: 600 })}
    ${text(PHONE_W - 20, 452, 'See all', { size: 12, weight: 600, fill: STREET, anchor: 'end' })}

    ${jobCard(470, 'Help move a sofa', '₦25,000', '1.8 km · Lekki · 3 applicants', '📦', true)}
    ${jobCard(586, 'Deep clean apartment', '₦35,000', '2.4 km · Ikate · 5 applicants', '🧹')}
    ${jobCard(702, 'Fix leaking tap', '₦15,000', '3.1 km · Ajah · Be first', '🔧')}

    <!-- bottom nav -->
    ${rect(0, PHONE_H - 74, PHONE_W, 74, { fill: SURFACE })}
    <line x1="0" y1="${PHONE_H - 74}" x2="${PHONE_W}" y2="${PHONE_H - 74}" stroke="${BORDER}"/>
    ${[0, 1, 3, 4]
      .map((i) => {
        const x = 39 + i * 78
        const active = i === 0
        return `<circle cx="${x}" cy="${PHONE_H - 44}" r="9" fill="none" stroke="${active ? STREET : MUTED}" stroke-width="2"/>
                ${text(x, PHONE_H - 20, ['Home', 'Explore', '', 'Chat', 'Profile'][i]!, {
                  size: 9,
                  weight: 600,
                  fill: active ? STREET : MUTED,
                  anchor: 'middle',
                })}`
      })
      .join('')}
    <circle cx="${PHONE_W / 2}" cy="${PHONE_H - 52}" r="27" fill="${STREET}"/>
    ${text(PHONE_W / 2, PHONE_H - 43, '+', { size: 28, weight: 600, fill: '#fff', anchor: 'middle' })}
  </svg>`
}

function appDiscover() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W}" height="${PHONE_H}" viewBox="0 0 ${PHONE_W} ${PHONE_H}">
    ${phoneChrome()}
    ${text(20, 78, 'Discover', { size: 24, weight: 600 })}

    <!-- filter chips -->
    ${['Nearest', 'Under ₦20k', 'Today', 'Remote']
      .map((label, i) => {
        const x = 20 + i * 88
        const on = i === 0
        return `${rect(x, 98, 80, 32, { r: 6, fill: on ? STREET : SURFACE, stroke: on ? STREET : BORDER })}
                ${text(x + 40, 119, label, { size: 10.5, weight: 600, fill: on ? '#fff' : INK, anchor: 'middle' })}`
      })
      .join('')}

    <!-- map panel -->
    ${rect(16, 146, PHONE_W - 32, 200, { r: 6, fill: '#E9EFEA' })}
    <path d="M16 300 Q 120 250 200 288 T 374 262" stroke="#CBD6CE" stroke-width="14" fill="none"/>
    <path d="M90 146 Q 130 220 96 346" stroke="#CBD6CE" stroke-width="10" fill="none"/>
    <path d="M250 146 Q 232 240 288 346" stroke="#D6DED8" stroke-width="8" fill="none"/>
    ${[
      [92, 208],
      [186, 246],
      [268, 196],
      [148, 300],
      [310, 288],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="${STREET}" stroke="#fff" stroke-width="3"/>`)
      .join('')}
    <circle cx="220" cy="272" r="17" fill="${MONEY}" stroke="#fff" stroke-width="3"/>
    ${text(220, 278, '₦', { size: 14, weight: 600, fill: '#fff', anchor: 'middle' })}

    ${text(20, 384, '24 jobs nearby', { size: 15, weight: 700 })}
    ${text(PHONE_W - 20, 384, 'Nearest ▾', { size: 12, weight: 600, fill: MUTED, anchor: 'end' })}

    ${jobCard(402, 'Dispatch to Yaba', '₦8,000', '0.9 km · Lekki · 1 applicant', '🛵', true)}
    ${jobCard(522, 'Makeup for wedding', '₦90,000', '2.2 km · Ikoyi · 7 applicants', '💅')}
    ${jobCard(642, 'Design a flyer', '₦45,000', 'Remote · 4 applicants', '🎨')}
    ${jobCard(762, 'Assemble wardrobe', '₦18,000', '1.4 km · Ikate', '🔧')}
  </svg>`
}

function appChat() {
  const bubbleIn = (y: number, w: number, lines: string[]) => `
    ${rect(20, y, w, 22 + lines.length * 19, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${lines.map((l, i) => text(36, y + 28 + i * 19, l, { size: 12.5 })).join('')}`

  const bubbleOut = (y: number, w: number, lines: string[]) => `
    ${rect(PHONE_W - 20 - w, y, w, 22 + lines.length * 19, { r: 6, fill: STREET })}
    ${lines
      .map((l, i) => text(PHONE_W - 36, y + 28 + i * 19, l, { size: 12.5, fill: '#fff', anchor: 'end' }))
      .join('')}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHONE_W}" height="${PHONE_H}" viewBox="0 0 ${PHONE_W} ${PHONE_H}">
    ${phoneChrome()}

    <!-- chat header -->
    ${rect(0, 48, PHONE_W, 72, { fill: SURFACE })}
    <line x1="0" y1="120" x2="${PHONE_W}" y2="120" stroke="${BORDER}"/>
    <circle cx="54" cy="84" r="19" fill="${MONEY_SOFT}"/>
    ${text(54, 90, 'DO', { size: 13, weight: 700, fill: '#0B5138', anchor: 'middle' })}
    <circle cx="67" cy="97" r="5" fill="${MONEY}" stroke="#fff" stroke-width="2"/>
    ${text(84, 80, 'Daniel Okafor', { size: 14, weight: 700 })}
    ${text(84, 98, 'Available now', { size: 11, fill: MONEY })}

    <!-- job context strip -->
    ${rect(16, 134, PHONE_W - 32, 56, { r: 6, fill: STREET_SOFT })}
    ${text(32, 158, 'Help move a sofa', { size: 12.5, weight: 700 })}
    ${text(32, 178, 'Agreed ₦25,000', { size: 11.5, weight: 600, fill: '#8A3A00' })}

    <!-- system: payment secured -->
    ${rect(78, 206, PHONE_W - 156, 34, { r: 6, fill: MONEY_SOFT })}
    ${text(PHONE_W / 2, 228, '🔒  Payment secured', { size: 11.5, weight: 600, fill: '#0B5138', anchor: 'middle' })}

    ${bubbleIn(258, 244, ['Good afternoon. I can be there', 'by 4pm with my vehicle.'])}
    ${bubbleOut(340, 218, ['Perfect. The sofa is on the', '2nd floor, no lift.'])}
    ${bubbleIn(422, 262, ['No problem — I am bringing', 'one extra hand for that.'])}
    ${bubbleOut(504, 150, ['See you at 4.'])}

    <!-- system: submitted -->
    ${rect(64, 568, PHONE_W - 128, 34, { r: 6, fill: '#FFF4E0' })}
    ${text(PHONE_W / 2, 590, '✓  Marked as done', { size: 11.5, weight: 600, fill: '#7A5200', anchor: 'middle' })}

    <!-- confirm CTA -->
    ${rect(16, 622, PHONE_W - 32, 92, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${text(32, 650, 'Confirm to release payment', { size: 13, weight: 700 })}
    ${text(32, 670, 'Auto-releases in 71 hours', { size: 11, fill: MUTED })}
    ${rect(32, 682, PHONE_W - 64, 20, { r: 4, fill: MONEY })}
    ${text(PHONE_W / 2, 696, 'Confirm & release ₦25,000', { size: 11, weight: 700, fill: '#fff', anchor: 'middle' })}

    <!-- composer -->
    ${rect(16, PHONE_H - 76, PHONE_W - 88, 46, { r: 6, fill: SURFACE, stroke: BORDER })}
    ${text(40, PHONE_H - 47, 'Message…', { size: 12.5, fill: MUTED })}
    <circle cx="${PHONE_W - 40}" cy="${PHONE_H - 53}" r="23" fill="${STREET}"/>
    <path d="M${PHONE_W - 48} ${PHONE_H - 53} l16 -7 -6 7 6 7 z" fill="#fff"/>
  </svg>`
}

/* ── scene art (photo stand-ins) ─────────────────────────────────────────── */

/**
 * Abstract branded scenes. Deliberately geometric rather than fake-photographic:
 * an obviously illustrative placeholder is honest, a fake photo is not.
 */
function scene(title: string, emoji: string, accent: string, w = 1200, h = 900) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.06"/>
      </linearGradient>
    </defs>
    ${rect(0, 0, w, h, { fill: PAPER })}
    ${rect(0, 0, w, h, { fill: 'url(#g)' })}
    <circle cx="${w * 0.78}" cy="${h * 0.22}" r="${h * 0.3}" fill="${accent}" opacity="0.16"/>
    <circle cx="${w * 0.2}" cy="${h * 0.8}" r="${h * 0.26}" fill="${accent}" opacity="0.1"/>
    <rect x="${w * 0.08}" y="${h * 0.55}" width="${w * 0.3}" height="${h * 0.3}" rx="28" fill="${SURFACE}" opacity="0.75"/>
    <rect x="${w * 0.44}" y="${h * 0.3}" width="${w * 0.34}" height="${h * 0.42}" rx="32" fill="${SURFACE}" opacity="0.9"/>
    ${text(w / 2, h * 0.52, emoji, { size: h * 0.16, anchor: 'middle' })}
    ${text(w / 2, h * 0.68, title, { size: 34, weight: 700, fill: INK, anchor: 'middle', opacity: 0.72 })}
    ${text(w / 2, h * 0.73, 'placeholder — replace with photography', {
      size: 17,
      weight: 500,
      fill: INK,
      anchor: 'middle',
      opacity: 0.34,
    })}
  </svg>`
}

/** Dark video poster with a drawn play affordance and a duration chip. */
function videoPoster(title: string, subtitle: string, duration: string, w = 1280, h = 720) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="v" cx="72%" cy="18%" r="78%">
        <stop offset="0%" stop-color="${STREET}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${INK}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${rect(0, 0, w, h, { fill: INK })}
    ${rect(0, 0, w, h, { fill: 'url(#v)' })}
    <circle cx="${w * 0.12}" cy="${h * 0.92}" r="${h * 0.3}" fill="${MONEY}" opacity="0.07"/>

    <circle cx="${w / 2}" cy="${h / 2 - 30}" r="62" fill="#ffffff" opacity="0.94"/>
    <path d="M${w / 2 - 18} ${h / 2 - 60} l46 30 -46 30 z" fill="${INK}"/>

    ${text(w / 2, h / 2 + 76, title, { size: 42, weight: 600, fill: PAPER, anchor: 'middle' })}
    ${text(w / 2, h / 2 + 116, subtitle, { size: 21, weight: 500, fill: PAPER, anchor: 'middle', opacity: 0.62 })}

    ${rect(w - 132, h - 76, 96, 38, { r: 6, fill: '#000000', opacity: 0.55 })}
    ${text(w - 84, h - 51, duration, { size: 16, weight: 700, fill: PAPER, anchor: 'middle' })}
  </svg>`
}

/** Portrait poster for a hustler story video. */
function storyPoster(name: string, _trade: string, _area: string, accent: string) {
  const w = 720
  const h = 960
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="45%" stop-color="${INK}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${INK}" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    ${rect(0, 0, w, h, { fill: accent })}
    <circle cx="${w * 0.5}" cy="${h * 0.34}" r="150" fill="#ffffff" opacity="0.9"/>
    ${text(w * 0.5, h * 0.4, name.charAt(0), { size: 140, weight: 600, fill: accent, anchor: 'middle' })}
    ${rect(0, 0, w, h, { fill: 'url(#s)' })}

    <circle cx="${w / 2}" cy="${h * 0.62}" r="44" fill="#ffffff" opacity="0.92"/>
    <path d="M${w / 2 - 13} ${h * 0.62 - 21} l33 21 -33 21 z" fill="${INK}"/>

  </svg>`
  // Name, trade and area are deliberately NOT drawn here. `StoryCard` renders
  // them as real text over the poster, and baking a second copy into the image
  // put two overlapping sets of type in the same corner. Text belongs to the
  // component, which can restyle and translate it; the image cannot.
}

/** Coverage map: abstract Lagos with labelled area pins. */
function coverageMap(w = 1400, h = 900) {
  const pins: Array<[number, number, string]> = [
    [0.22, 0.34, 'Ikeja'],
    [0.34, 0.52, 'Yaba'],
    [0.3, 0.7, 'Surulere'],
    [0.5, 0.62, 'Ikoyi'],
    [0.62, 0.7, 'Victoria Island'],
    [0.74, 0.6, 'Lekki'],
    [0.86, 0.55, 'Ajah'],
    [0.46, 0.32, 'Magodo'],
    [0.16, 0.62, 'Festac'],
  ]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${rect(0, 0, w, h, { fill: '#EDF2EE' })}
    <path d="M0 ${h * 0.78} Q ${w * 0.3} ${h * 0.66} ${w * 0.55} ${h * 0.8} T ${w} ${h * 0.7} L ${w} ${h} L 0 ${h} Z"
          fill="#CFE0E8" opacity="0.85"/>
    <path d="M${w * 0.05} ${h * 0.45} Q ${w * 0.35} ${h * 0.38} ${w * 0.7} ${h * 0.5} T ${w * 0.98} ${h * 0.46}"
          stroke="#D9E2DB" stroke-width="26" fill="none" stroke-linecap="round"/>
    <path d="M${w * 0.28} ${h * 0.12} Q ${w * 0.34} ${h * 0.45} ${w * 0.3} ${h * 0.88}"
          stroke="#D9E2DB" stroke-width="20" fill="none" stroke-linecap="round"/>

    ${pins
      .map(
        ([px, py, label]) => `
      <circle cx="${w * px}" cy="${h * py}" r="34" fill="${STREET}" opacity="0.14"/>
      <circle cx="${w * px}" cy="${h * py}" r="13" fill="${STREET}" stroke="#fff" stroke-width="4"/>
      ${text(w * px, h * py + 44, label, { size: 20, weight: 700, fill: INK, anchor: 'middle', opacity: 0.75 })}`,
      )
      .join('')}
  </svg>`
}

/* ── run ─────────────────────────────────────────────────────────────────── */

async function main() {
  mkdirSync(OUT, { recursive: true })
  console.log('→ generating landing media\n')

  // App screenshots at 2× for crisp rendering on phones.
  await render(appHome(), 'app-home.png', PHONE_W * 2, PHONE_H * 2)
  await render(appDiscover(), 'app-discover.png', PHONE_W * 2, PHONE_H * 2)
  await render(appChat(), 'app-chat.png', PHONE_W * 2, PHONE_H * 2)

  await render(scene('Post it. Someone nearby sees it.', '📦', STREET), 'scene-post.png', 1200, 900)
  await render(scene('Skilled people, minutes away', '🔧', MONEY), 'scene-hustlers.png', 1200, 900)
  await render(scene('Paid the moment it is confirmed', '🔒', '#6B4EE6'), 'scene-payment.png', 1200, 900)
  await render(scene('Every kind of work', '🎨', WARNING), 'scene-categories.png', 1200, 900)

  await render(
    videoPoster('How Hustle Street works', 'From posting a job to getting paid', '1:48'),
    'poster-how-it-works.png',
    1280,
    720,
  )
  await render(
    videoPoster('Your money, held safely', 'What happens between hiring and paying', '2:12'),
    'poster-escrow.png',
    1280,
    720,
  )

  await render(storyPoster('Blessing Adeyemi', 'Makeup Artist', 'Victoria Island', TANGERINE), 'story-blessing.png', 720, 960)
  await render(storyPoster('Ibrahim Musa', 'Plumber', 'Yaba', AZURE), 'story-ibrahim.png', 720, 960)
  await render(storyPoster('Ngozi Eze', 'Web Developer', 'Ikeja', MONEY), 'story-ngozi.png', 720, 960)

  await render(coverageMap(), 'coverage-lagos.png', 1400, 900)

  console.log('\n✓ media generated into public/media/')
  console.log('  These are placeholders. See the header of this file for the replacement order.\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
