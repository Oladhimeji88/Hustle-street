#!/usr/bin/env tsx
/**
 * Generates a VAPID key pair for Web Push.
 *
 *   pnpm keys:vapid
 *
 * Run once per environment. The public key is safe to expose; the private key
 * must only ever live in server-side environment variables.
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('\nVAPID keys generated. Add these to your environment:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:support@hustlestreet.ng\n')
console.log('Keep the private key secret. Rotating it invalidates every existing')
console.log('push subscription, so users would need to re-enable notifications.\n')
