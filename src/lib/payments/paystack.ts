import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getServerEnv } from '@/lib/config/env'
import type { CurrencyCode } from '@/types/database'
import {
  PaymentProviderError,
  type AccountResolution,
  type Bank,
  type InitializeChargeInput,
  type InitializeChargeResult,
  type InitiateTransferInput,
  type InitiateTransferResult,
  type PaymentProvider,
  type RefundInput,
  type RefundResult,
  type TransferRecipientInput,
  type TransferRecipientResult,
  type VerifiedCharge,
  type WebhookEvent,
} from './types'

const API_BASE = 'https://api.paystack.co'
const PROVIDER = 'paystack'

interface PaystackEnvelope<T> {
  status: boolean
  message: string
  data: T
}

/**
 * Paystack adapter.
 *
 * Notes that matter:
 *  - Paystack amounts are already in minor units (kobo) for NGN, so no scaling
 *    is applied. The `currency` is passed through explicitly rather than
 *    assumed, so a future GHS/KES launch does not silently mis-scale.
 *  - Webhook signatures are HMAC-SHA512 of the RAW body using the secret key.
 *    The body must never be re-serialised before verification — JSON key order
 *    is not guaranteed to round-trip.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = PROVIDER

  private get secretKey(): string {
    return getServerEnv().PAYSTACK_SECRET_KEY
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey)
  }

  private async request<T>(
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new PaymentProviderError(PROVIDER, 'Paystack is not configured')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.secretKey}`)
    headers.set('Content-Type', 'application/json')
    if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)

    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        // Never let a hanging provider hold a serverless function open.
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
      })
    } catch (cause) {
      throw new PaymentProviderError(PROVIDER, 'Could not reach Paystack. Please try again.', {
        retryable: true,
        cause,
      })
    }

    const text = await response.text()
    let payload: PaystackEnvelope<T>
    try {
      payload = JSON.parse(text)
    } catch (cause) {
      throw new PaymentProviderError(PROVIDER, 'Unexpected response from Paystack', { cause })
    }

    if (!response.ok || !payload.status) {
      throw new PaymentProviderError(PROVIDER, payload.message || 'Paystack request failed', {
        providerCode: String(response.status),
        // 5xx and 429 are worth retrying; a 400 means we sent something wrong.
        retryable: response.status >= 500 || response.status === 429,
      })
    }

    return payload.data
  }

  async initializeCharge(input: InitializeChargeInput): Promise<InitializeChargeResult> {
    const data = await this.request<{
      authorization_url: string
      access_code: string
      reference: string
    }>('/transaction/initialize', {
      method: 'POST',
      idempotencyKey: input.reference,
      body: JSON.stringify({
        reference: input.reference,
        amount: input.amountMinor,
        currency: input.currency,
        email: input.email,
        callback_url: input.callbackUrl,
        metadata: input.metadata ?? {},
        channels: ['card', 'bank', 'ussd', 'bank_transfer', 'mobile_money'],
      }),
    })

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
    }
  }

  async verifyCharge(reference: string): Promise<VerifiedCharge> {
    const data = await this.request<{
      id: number
      reference: string
      status: string
      amount: number
      currency: string
      fees: number | null
      paid_at: string | null
      channel: string | null
      gateway_response: string | null
    }>(`/transaction/verify/${encodeURIComponent(reference)}`)

    const status: VerifiedCharge['status'] =
      data.status === 'success'
        ? 'success'
        : data.status === 'abandoned'
          ? 'abandoned'
          : data.status === 'failed'
            ? 'failed'
            : 'pending'

    return {
      reference: data.reference,
      providerReference: String(data.id),
      status,
      amountMinor: data.amount,
      currency: data.currency as CurrencyCode,
      providerFeeMinor: data.fees ?? 0,
      paidAt: data.paid_at,
      channel: data.channel,
      failureReason: status === 'failed' ? (data.gateway_response ?? undefined) : undefined,
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const data = await this.request<{ id: number; status: string }>('/refund', {
      method: 'POST',
      idempotencyKey: `refund:${input.providerReference}:${input.amountMinor ?? 'full'}`,
      body: JSON.stringify({
        transaction: input.providerReference,
        ...(input.amountMinor ? { amount: input.amountMinor } : {}),
        merchant_note: input.reason ?? 'Hustle Street refund',
      }),
    })

    return {
      providerReference: String(data.id),
      status: data.status === 'processed' ? 'processed' : data.status === 'failed' ? 'failed' : 'pending',
    }
  }

  async listBanks(currency: CurrencyCode): Promise<Bank[]> {
    const country = currency === 'GHS' ? 'ghana' : currency === 'KES' ? 'kenya' : 'nigeria'
    const data = await this.request<Array<{ code: string; name: string; slug: string }>>(
      `/bank?country=${country}&currency=${currency}`,
    )
    return data.map((bank) => ({ code: bank.code, name: bank.name, slug: bank.slug }))
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<AccountResolution> {
    const data = await this.request<{ account_name: string; account_number: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    )
    return { accountName: data.account_name, accountNumber: data.account_number }
  }

  async createTransferRecipient(input: TransferRecipientInput): Promise<TransferRecipientResult> {
    const data = await this.request<{
      recipient_code: string
      details: { account_number: string; account_name: string; bank_name: string }
    }>('/transferrecipient', {
      method: 'POST',
      body: JSON.stringify({
        type: 'nuban',
        name: input.accountName,
        account_number: input.accountNumber,
        bank_code: input.bankCode,
        currency: input.currency,
      }),
    })

    return {
      recipientCode: data.recipient_code,
      accountName: data.details.account_name,
      bankName: data.details.bank_name,
      last4: data.details.account_number.slice(-4),
    }
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    const data = await this.request<{ transfer_code: string; status: string }>('/transfer', {
      method: 'POST',
      // Paystack dedupes on this, which is what stops a retried payout from
      // sending the money twice.
      idempotencyKey: input.reference,
      body: JSON.stringify({
        source: 'balance',
        reference: input.reference,
        amount: input.amountMinor,
        recipient: input.recipientCode,
        reason: input.reason,
        currency: input.currency,
      }),
    })

    return {
      providerReference: data.transfer_code,
      status: data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
    }
  }

  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null {
    const signature = headers.get('x-paystack-signature')
    if (!signature) return null

    const env = getServerEnv()
    // Paystack signs with the secret key unless a distinct webhook secret is set.
    const signingKey = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY
    if (!signingKey) return null

    const expected = createHmac('sha512', signingKey).update(rawBody, 'utf8').digest('hex')

    // Constant-time comparison. A length mismatch is itself a rejection, and
    // timingSafeEqual throws on unequal lengths, so check first.
    const provided = Buffer.from(signature, 'utf8')
    const expectedBuffer = Buffer.from(expected, 'utf8')
    if (provided.length !== expectedBuffer.length) return null
    if (!timingSafeEqual(provided, expectedBuffer)) return null

    let payload: { event?: string; data?: Record<string, unknown> }
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return null
    }

    if (!payload.event || !payload.data) return null

    const data = payload.data
    const reference =
      typeof data.reference === 'string'
        ? data.reference
        : typeof data.transfer_code === 'string'
          ? data.transfer_code
          : null

    // Paystack does not send an event id, so derive a stable one from the event
    // type plus the signature: identical redeliveries collapse to one row, and
    // a genuinely new event always differs.
    const id = `${payload.event}:${expected.slice(0, 32)}`

    return { id, type: payload.event, reference, raw: payload as Record<string, unknown> }
  }
}
