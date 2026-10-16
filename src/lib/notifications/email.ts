import 'server-only'

import { getServerEnv, publicEnv } from '@/lib/config/env'

/**
 * Transactional email.
 *
 * A provider port plus a small template library. In development the `console`
 * provider prints the message instead of sending it, so the whole notification
 * pipeline can be exercised end to end with no vendor account. Production
 * refuses to boot with `console` selected (see `env.ts`).
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  tag?: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<{ id: string | null }>
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console'
  async send(message: EmailMessage) {
    console.info(
      `\n──────── EMAIL (${message.tag ?? 'untagged'}) ────────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n────────────────────────────────\n`,
    )
    return { id: null }
  }
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  async send(message: EmailMessage) {
    const env = getServerEnv()
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        tags: message.tag ? [{ name: 'category', value: message.tag }] : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new Error(`Resend rejected the message: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { id?: string }
    return { id: data.id ?? null }
  }
}

class PostmarkProvider implements EmailProvider {
  readonly name = 'postmark'
  async send(message: EmailMessage) {
    const env = getServerEnv()
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': env.EMAIL_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: env.EMAIL_FROM,
        To: message.to,
        Subject: message.subject,
        HtmlBody: message.html,
        TextBody: message.text,
        ReplyTo: message.replyTo,
        Tag: message.tag,
        MessageStream: 'outbound',
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new Error(`Postmark rejected the message: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { MessageID?: string }
    return { id: data.MessageID ?? null }
  }
}

let cached: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (cached) return cached
  const env = getServerEnv()

  cached =
    env.EMAIL_PROVIDER === 'resend'
      ? new ResendProvider()
      : env.EMAIL_PROVIDER === 'postmark'
        ? new PostmarkProvider()
        : new ConsoleEmailProvider()

  return cached
}

export async function sendEmail(message: EmailMessage): Promise<{ id: string | null }> {
  return getEmailProvider().send(message)
}

// ─── Templates ───────────────────────────────────────────────────────────────

const APP_URL = publicEnv.NEXT_PUBLIC_APP_URL

/** Escapes interpolated values so a display name can never inject markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Shared shell. Inline styles only — email clients strip <style> blocks, and
 * Gmail in particular ignores anything but inline CSS.
 */
function shell(content: string, preheader: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(11,15,19,0.06);">
<tr><td style="padding:28px 32px 8px;">
  <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0B0F13;">Hustle</span><span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#FF5A1F;">Street</span>
</td></tr>
<tr><td style="padding:8px 32px 32px;color:#0B0F13;font-size:15px;line-height:1.6;">
${content}
</td></tr>
</table>
<p style="max-width:560px;margin:20px auto 0;color:#6B7280;font-size:12px;line-height:1.6;text-align:center;">
  You are receiving this because you have a Hustle Street account.<br>
  <a href="${APP_URL}/settings/notifications" style="color:#6B7280;">Manage notification settings</a>
</p>
</td></tr></table></body></html>`
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:12px;background:#FF5A1F;">
<a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;">${esc(label)}</a>
</td></tr></table>`
}

export const emailTemplates = {
  welcome(input: { name: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;letter-spacing:-0.02em;">Welcome to Hustle Street, ${esc(input.name)} 👋</h1>
<p style="margin:0 0 12px;color:#4B5563;">You're in. Whether you need something done or you're ready to earn, everything starts nearby.</p>
<ul style="margin:0 0 8px;padding-left:20px;color:#4B5563;">
  <li style="margin-bottom:6px;"><strong>Need something done?</strong> Post a job in under two minutes.</li>
  <li style="margin-bottom:6px;"><strong>Ready to hustle?</strong> Add your skills and see jobs near you.</li>
</ul>
${button('Open Hustle Street', `${APP_URL}/home`)}
<p style="margin:0;color:#6B7280;font-size:13px;">Payments are held securely until a job is confirmed complete — for both sides.</p>`
    return {
      subject: 'Welcome to Hustle Street',
      html: shell(content, 'Get things done. Find people who can.'),
      text: `Welcome to Hustle Street, ${input.name}!\n\nPost a job in under two minutes, or add your skills and start finding work near you.\n\n${APP_URL}/home`,
      tag: 'welcome',
    }
  },

  verifyEmail(input: { name: string; url: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Confirm your email</h1>
<p style="margin:0 0 12px;color:#4B5563;">Hi ${esc(input.name)}, confirm this address to secure your account and start using Hustle Street.</p>
${button('Confirm email', input.url)}
<p style="margin:0;color:#6B7280;font-size:13px;">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>`
    return {
      subject: 'Confirm your email — Hustle Street',
      html: shell(content, 'One click to confirm your email address.'),
      text: `Confirm your email address:\n${input.url}\n\nThis link expires in 24 hours.`,
      tag: 'verify-email',
    }
  },

  resetPassword(input: { name: string; url: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Reset your password</h1>
<p style="margin:0 0 12px;color:#4B5563;">Hi ${esc(input.name)}, use the button below to choose a new password.</p>
${button('Reset password', input.url)}
<p style="margin:0;color:#6B7280;font-size:13px;">This link expires in 1 hour. If you did not request this, your account is still safe — nothing has changed.</p>`
    return {
      subject: 'Reset your Hustle Street password',
      html: shell(content, 'Choose a new password.'),
      text: `Reset your password:\n${input.url}\n\nThis link expires in 1 hour.`,
      tag: 'reset-password',
    }
  },

  applicationReceived(input: {
    posterName: string
    hustlerName: string
    jobTitle: string
    amount: string
    jobId: string
  }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">${esc(input.hustlerName)} applied to your job</h1>
<p style="margin:0 0 4px;color:#4B5563;"><strong>${esc(input.jobTitle)}</strong></p>
<p style="margin:0 0 12px;color:#4B5563;">Their offer: <strong style="color:#0B0F13;">${esc(input.amount)}</strong></p>
${button('View application', `${APP_URL}/my-jobs/${input.jobId}/applications`)}`
    return {
      subject: `New application: ${input.jobTitle}`,
      html: shell(content, `${input.hustlerName} wants to do your job.`),
      text: `${input.hustlerName} applied to "${input.jobTitle}" and offered ${input.amount}.\n\n${APP_URL}/my-jobs/${input.jobId}/applications`,
      tag: 'application-received',
    }
  },

  applicationAccepted(input: {
    hustlerName: string
    jobTitle: string
    amount: string
    jobId: string
  }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;">You've got the job! 🎉</h1>
<p style="margin:0 0 4px;color:#4B5563;"><strong>${esc(input.jobTitle)}</strong></p>
<p style="margin:0 0 12px;color:#4B5563;">Agreed price: <strong style="color:#0B0F13;">${esc(input.amount)}</strong></p>
<p style="margin:0 0 12px;color:#4B5563;">Once the poster funds the job, the money is held securely and released to you when they confirm the work is done.</p>
${button('Open the job', `${APP_URL}/jobs/${input.jobId}`)}`
    return {
      subject: `You've got the job: ${input.jobTitle}`,
      html: shell(content, 'Your application was accepted.'),
      text: `You've got the job: "${input.jobTitle}" at ${input.amount}.\n\n${APP_URL}/jobs/${input.jobId}`,
      tag: 'application-accepted',
    }
  },

  paymentSecured(input: { jobTitle: string; amount: string; jobId: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Payment secured</h1>
<p style="margin:0 0 12px;color:#4B5563;"><strong>${esc(input.amount)}</strong> is being held for <strong>${esc(input.jobTitle)}</strong>. It is released once the job is confirmed complete.</p>
${button('View job', `${APP_URL}/jobs/${input.jobId}`)}`
    return {
      subject: `Payment secured — ${input.jobTitle}`,
      html: shell(content, 'The money is held safely until the job is done.'),
      text: `${input.amount} is held securely for "${input.jobTitle}".\n\n${APP_URL}/jobs/${input.jobId}`,
      tag: 'payment-secured',
    }
  },

  paymentReleased(input: { amount: string; jobTitle: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">You've been paid 💚</h1>
<p style="margin:0 0 12px;color:#4B5563;"><strong style="font-size:20px;color:#0B0F13;">${esc(input.amount)}</strong> from <strong>${esc(input.jobTitle)}</strong> has been released to your wallet.</p>
${button('View wallet', `${APP_URL}/wallet`)}`
    return {
      subject: `You've been paid ${input.amount}`,
      html: shell(content, 'Your earnings have been released.'),
      text: `${input.amount} from "${input.jobTitle}" has been released to your wallet.\n\n${APP_URL}/wallet`,
      tag: 'payment-released',
    }
  },

  jobCompleted(input: { jobTitle: string; jobId: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Job completed</h1>
<p style="margin:0 0 12px;color:#4B5563;"><strong>${esc(input.jobTitle)}</strong> is done and payment has been released.</p>
${button('Leave a review', `${APP_URL}/jobs/${input.jobId}/review`)}`
    return {
      subject: `Completed: ${input.jobTitle}`,
      html: shell(content, 'Tell everyone how it went.'),
      text: `"${input.jobTitle}" is complete.\n\nLeave a review: ${APP_URL}/jobs/${input.jobId}/review`,
      tag: 'job-completed',
    }
  },

  reviewRequest(input: { name: string; jobTitle: string; jobId: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">How did it go, ${esc(input.name)}?</h1>
<p style="margin:0 0 12px;color:#4B5563;">Leave a review for <strong>${esc(input.jobTitle)}</strong>. Reviews stay hidden until both sides have submitted, so you can be honest.</p>
${button('Leave a review', `${APP_URL}/jobs/${input.jobId}/review`)}`
    return {
      subject: `Review your job: ${input.jobTitle}`,
      html: shell(content, 'Reviews stay hidden until both sides submit.'),
      text: `Leave a review for "${input.jobTitle}": ${APP_URL}/jobs/${input.jobId}/review`,
      tag: 'review-request',
    }
  },

  disputeUpdate(input: {
    reference: string
    headline: string
    detail: string
    disputeId: string
  }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">${esc(input.headline)}</h1>
<p style="margin:0 0 8px;color:#6B7280;font-size:13px;">Dispute ${esc(input.reference)}</p>
<p style="margin:0 0 12px;color:#4B5563;">${esc(input.detail)}</p>
${button('View dispute', `${APP_URL}/disputes/${input.disputeId}`)}`
    return {
      subject: `Dispute update — ${input.reference}`,
      html: shell(content, input.detail),
      text: `${input.headline}\n\n${input.detail}\n\n${APP_URL}/disputes/${input.disputeId}`,
      tag: 'dispute-update',
    }
  },

  securityAlert(input: { name: string; event: string; detail: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Security alert</h1>
<p style="margin:0 0 12px;color:#4B5563;">Hi ${esc(input.name)}, we noticed: <strong>${esc(input.event)}</strong></p>
<p style="margin:0 0 12px;color:#4B5563;">${esc(input.detail)}</p>
<p style="margin:0 0 12px;color:#4B5563;">If this wasn't you, change your password and sign out of all devices right away.</p>
${button('Review account security', `${APP_URL}/settings/security`)}`
    return {
      subject: 'Security alert on your Hustle Street account',
      html: shell(content, input.event),
      text: `Security alert: ${input.event}\n\n${input.detail}\n\nIf this wasn't you: ${APP_URL}/settings/security`,
      tag: 'security-alert',
    }
  },

  payoutProcessed(input: { amount: string; bank: string; last4: string }): Omit<EmailMessage, 'to'> {
    const content = `
<h1 style="margin:16px 0 8px;font-size:22px;font-weight:800;">Withdrawal sent</h1>
<p style="margin:0 0 12px;color:#4B5563;"><strong>${esc(input.amount)}</strong> is on its way to your ${esc(input.bank)} account ending ${esc(input.last4)}.</p>
<p style="margin:0 0 12px;color:#6B7280;font-size:13px;">Bank transfers usually arrive within minutes, but can take up to 24 hours.</p>
${button('View wallet', `${APP_URL}/wallet`)}`
    return {
      subject: `Withdrawal sent — ${input.amount}`,
      html: shell(content, 'Your money is on the way.'),
      text: `${input.amount} is on its way to your ${input.bank} account ending ${input.last4}.\n\n${APP_URL}/wallet`,
      tag: 'payout-processed',
    }
  },
}
