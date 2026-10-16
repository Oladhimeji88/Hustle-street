import 'server-only'

import { getServerEnv } from '@/lib/config/env'

/**
 * SMS / WhatsApp delivery.
 *
 * Reserved for the highest-stakes moments only: OTP, security alerts, "you've
 * got the job", "you've been paid". SMS costs real money per message in
 * Nigeria and lands in a channel people cannot mute, so it is opt-in and
 * deliberately narrow.
 *
 * Termii is the default because it has the best Nigerian delivery rates; Twilio
 * is here for markets Termii does not cover.
 */

export interface SmsMessage {
  /** E.164. */
  to: string
  body: string
  /** OTP messages use a dedicated route with better delivery on some carriers. */
  channel?: 'generic' | 'otp'
}

export interface SmsProvider {
  readonly name: string
  send(message: SmsMessage): Promise<{ id: string | null }>
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console'
  async send(message: SmsMessage) {
    console.info(`\n──────── SMS ────────\nTo: ${message.to}\n${message.body}\n─────────────────────\n`)
    return { id: null }
  }
}

class TermiiProvider implements SmsProvider {
  readonly name = 'termii'
  async send(message: SmsMessage) {
    const env = getServerEnv()
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.SMS_API_KEY,
        to: message.to.replace('+', ''),
        from: env.SMS_SENDER_ID,
        sms: message.body,
        type: 'plain',
        channel: message.channel === 'otp' ? 'dnd' : 'generic',
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new Error(`Termii rejected the message: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { message_id?: string }
    return { id: data.message_id ?? null }
  }
}

class TwilioProvider implements SmsProvider {
  readonly name = 'twilio'
  async send(message: SmsMessage) {
    const env = getServerEnv()
    // SMS_API_KEY carries "accountSid:authToken".
    const [accountSid, authToken] = env.SMS_API_KEY.split(':')
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials must be provided as "accountSid:authToken"')
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: message.to,
          From: env.SMS_SENDER_ID,
          Body: message.body,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )

    if (!response.ok) {
      throw new Error(`Twilio rejected the message: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { sid?: string }
    return { id: data.sid ?? null }
  }
}

let cached: SmsProvider | null = null

export function getSmsProvider(): SmsProvider {
  if (cached) return cached
  const env = getServerEnv()

  cached =
    env.SMS_PROVIDER === 'termii'
      ? new TermiiProvider()
      : env.SMS_PROVIDER === 'twilio'
        ? new TwilioProvider()
        : new ConsoleSmsProvider()

  return cached
}

export async function sendSms(message: SmsMessage): Promise<{ id: string | null }> {
  return getSmsProvider().send(message)
}

export const smsTemplates = {
  otp: (code: string) =>
    `${code} is your Hustle Street verification code. It expires in 10 minutes. Never share it with anyone.`,

  applicationAccepted: (jobTitle: string) =>
    `You've got the job! "${jobTitle.slice(0, 60)}" is yours on Hustle Street. Open the app to get started.`,

  paymentReleased: (amount: string) =>
    `Hustle Street: ${amount} has been released to your wallet. Withdraw any time from the app.`,

  securityAlert: (event: string) =>
    `Hustle Street security alert: ${event}. If this wasn't you, change your password immediately.`,
}
