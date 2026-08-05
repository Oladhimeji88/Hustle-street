#!/usr/bin/env tsx
/**
 * Generates every PWA icon from one source SVG.
 *
 * Keeping the brand mark as code rather than committing a dozen PNGs means the
 * icon set can never drift out of sync with the logo, and a colour change is a
 * one-line edit followed by `pnpm icons`.
 *
 *   pnpm dlx tsx scripts/generate-icons.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT_DIR = join(process.cwd(), 'public', 'icons')

const STREET = '#FF5A1F'
const INK = '#0B0F13'
const PAPER = '#FAF9F7'

/**
 * The mark: an "H" cut by an angled street bar, on ink.
 * `safeInset` shrinks the artwork for maskable icons so Android's circular mask
 * cannot clip it (the spec reserves the outer 20%).
 */
function markSvg(size: number, { maskable = false, background = INK } = {}) {
  const inset = maskable ? size * 0.2 : size * 0.14
  const box = size - inset * 2
  const stroke = box * 0.17
  const gap = box * 0.26

  const left = inset + gap
  const right = inset + box - gap
  const top = inset + box * 0.14
  const bottom = inset + box * 0.86

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="${background}"/>
  <g stroke-linecap="round">
    <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${PAPER}" stroke-width="${stroke}"/>
    <line x1="${right}" y1="${top}" x2="${right}" y2="${bottom}" stroke="${PAPER}" stroke-width="${stroke}"/>
    <line x1="${left}" y1="${(top + bottom) / 2}" x2="${right}" y2="${(top + bottom) / 2}" stroke="${STREET}" stroke-width="${stroke}"/>
  </g>
  <line x1="${inset + box * 0.08}" y1="${bottom + stroke * 0.55}" x2="${inset + box * 0.64}" y2="${bottom + stroke * 0.55}"
        stroke="${STREET}" stroke-width="${stroke * 0.42}" stroke-linecap="round" opacity="0.85"
        transform="rotate(-8 ${size / 2} ${size / 2})"/>
</svg>`
}

/** Simple glyph icons for the manifest shortcuts. */
function shortcutSvg(size: number, emoji: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.24}" fill="${STREET}"/>
  <text x="50%" y="50%" font-size="${size * 0.52}" text-anchor="middle" dominant-baseline="central">${emoji}</text>
</svg>`
}

async function render(svg: string, filename: string, size: number) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
  writeFileSync(join(OUT_DIR, filename), buffer)
  console.log(`  ✓ ${filename} (${size}×${size})`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('→ generating PWA icons')

  await render(markSvg(512), 'icon-512.png', 512)
  await render(markSvg(192), 'icon-192.png', 192)
  await render(markSvg(180), 'apple-touch-icon.png', 180)
  await render(markSvg(512, { maskable: true, background: INK }), 'maskable-512.png', 512)
  await render(markSvg(192, { maskable: true, background: INK }), 'maskable-192.png', 192)

  // Monochrome badge for the Android notification tray.
  await render(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
       <rect width="72" height="72" fill="none"/>
       <g stroke="#FFFFFF" stroke-width="9" stroke-linecap="round">
         <line x1="24" y1="16" x2="24" y2="56"/>
         <line x1="48" y1="16" x2="48" y2="56"/>
         <line x1="24" y1="36" x2="48" y2="36"/>
       </g>
     </svg>`,
    'badge-72.png',
    72,
  )

  await render(shortcutSvg(96, '➕'), 'shortcut-post.png', 96)
  await render(shortcutSvg(96, '🔍'), 'shortcut-work.png', 96)
  await render(shortcutSvg(96, '💬'), 'shortcut-messages.png', 96)
  await render(shortcutSvg(96, '💰'), 'shortcut-wallet.png', 96)

  // Open Graph card.
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${INK}"/>
    <circle cx="1010" cy="120" r="320" fill="${STREET}" opacity="0.20"/>
    <text x="80" y="300" font-family="system-ui,-apple-system,sans-serif" font-size="86" font-weight="800" fill="${PAPER}">Get things done.</text>
    <text x="80" y="400" font-family="system-ui,-apple-system,sans-serif" font-size="86" font-weight="800" fill="${STREET}">Find people who can.</text>
    <text x="80" y="480" font-family="system-ui,-apple-system,sans-serif" font-size="34" fill="#9AA4AE">Hustle Street · a local marketplace for getting things done</text>
  </svg>`

  const ogBuffer = await sharp(Buffer.from(og)).png().toBuffer()
  writeFileSync(join(process.cwd(), 'public', 'og.png'), ogBuffer)
  console.log('  ✓ og.png (1200×630)')

  console.log('✓ icons generated')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
