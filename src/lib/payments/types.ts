import type { CurrencyCode } from '@/types/database'

/**
 * The payment provider port.
 *
 * Everything the product needs from a payment processor is expressed here.
 * Adding Flutterwave (or a second provider per country) means implementing this
 * interface — no domain code changes, no new branches in the escrow logic.
 *
 * Deliberately *not* in this interface: anything that would let a provider
 * decide business outcomes. Providers move money and report facts; the ledger
 * decides what those facts mean.
 */

export interface InitializeChargeInput {
  /** Our transaction reference — becomes the provider's reference too. */
  reference: string
  amountMinor: number
  currency: CurrencyCode
  email: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

export interface InitializeChargeResult {
  /** Hosted checkout URL to redirect the payer to. */
  authorizationUrl: string
  /** Provider-side access code, for inline checkout. */
  accessCode: string
  reference: string
}

export interface VerifiedCharge {
  reference: string
  providerReference: string
  status: 'success' | 'failed' | 'pending' | 'abandoned'
  amountMinor: number
  currency: CurrencyCode
  /** What the provider kept. Recorded for reconciliation. */
  providerFeeMinor: number
  paidAt: string | null
  channel: string | null
  failureReason?: string
}

export interface TransferRecipientInput {
  accountNumber: string
  bankCode: string
  accountName: string
  currency: CurrencyCode
}

export interface TransferRecipientResult {
  recipientCode: string
  accountName: string
  bankName: string
  last4: string
}

export interface InitiateTransferInput {
  reference: string
  recipientCode: string
  amountMinor: number
  currency: CurrencyCode
  reason: string
}

export interface InitiateTransferResult {
  providerReference: string
  status: 'pending' | 'success' | 'failed'
}

export interface RefundInput {
  providerReference: string
  amountMinor?: number
  reason?: string
}

export interface RefundResult {
  providerReference: string
  status: 'pending' | 'processed' | 'failed'
}

export interface Bank {
  code: string
  name: string
  slug: string
}

export interface AccountResolution {
  accountName: string
  accountNumber: string
}

/**
 * A webhook event, after signature verification.
 *
 * `id` must be stable and unique per event — it is what makes replay
 * protection work. If a provider does not supply one, the adapter derives a
 * deterministic id from the payload.
 */
export interface WebhookEvent {
  id: string
  type: string
  /** Our own reference, extracted from the provider's payload. */
  reference: string | null
  raw: Record<string, unknown>
}

export interface PaymentProvider {
  readonly name: string

  /** True when the adapter has the credentials it needs. */
  isConfigured(): boolean

  initializeCharge(input: InitializeChargeInput): Promise<InitializeChargeResult>
  verifyCharge(reference: string): Promise<VerifiedCharge>
  refund(input: RefundInput): Promise<RefundResult>

  listBanks(currency: CurrencyCode): Promise<Bank[]>
  resolveAccount(accountNumber: string, bankCode: string): Promise<AccountResolution>
  createTransferRecipient(input: TransferRecipientInput): Promise<TransferRecipientResult>
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>

  /**
   * Verifies the signature over the RAW request body and parses the event.
   * Returns null when the signature does not match — the caller must treat
   * that as hostile, not as a malformed request.
   */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null
}

export class PaymentProviderError extends Error {
  readonly provider: string
  readonly providerCode?: string
  readonly retryable: boolean

  constructor(
    provider: string,
    message: string,
    options: { providerCode?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'PaymentProviderError'
    this.provider = provider
    this.providerCode = options.providerCode
    this.retryable = options.retryable ?? false
  }
}
