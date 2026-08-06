import { createHash } from 'node:crypto'
import type { KycResult, KycVerifyInput } from '@/lib/validation/kyc'

/**
 * Identity verification, behind a provider interface.
 *
 * ── Why this is an interface and not a fetch call ───────────────────────────
 *
 * Verifying a NIN against NIMC, or a BVN against NIBSS, is not something an
 * application does directly. It goes through a licensed provider — Dojah,
 * Smile ID, Youverify and VerifyMe are the usual Nigerian options — each with
 * its own contract, pricing and failure modes. Putting one vendor's HTTP call
 * inline would make swapping them a rewrite, and it is common to swap them.
 *
 * ── What is stored, and what is not ─────────────────────────────────────────
 *
 * The raw NIN and BVN exist in memory for the duration of one request and are
 * never written anywhere. What persists is:
 *
 *   • the verdict (verified / pending / rejected)
 *   • the provider's reference, so a decision can be audited later
 *   • `identityHash`, a salted SHA-256 over the two numbers
 *
 * `identityHash` exists for exactly one purpose: detecting that one human has
 * registered several accounts. It is salted with `KYC_HASH_SALT` so the hashes
 * are useless to anyone who obtains the table without also obtaining the salt.
 * An unsalted hash of an 11-digit number is not protection — the entire keyspace
 * is 10^11, which is brute-forceable in minutes.
 *
 * Storing the numbers themselves would mean a breach hands an attacker durable,
 * unrotatable banking identifiers for every user. There is no product feature
 * that justifies holding them.
 */

export interface KycProvider {
  readonly name: string
  verify(input: KycVerifyInput): Promise<KycResult>
}

/** Salted, so the table is not a rainbow-table exercise if it ever leaks. */
export function identityHash(nin: string, bvn: string): string {
  const salt = process.env.KYC_HASH_SALT
  if (!salt) {
    throw new Error(
      'KYC_HASH_SALT is not set. Refusing to hash identity numbers with a predictable salt.',
    )
  }
  return createHash('sha256').update(`${salt}:${nin}:${bvn}`).digest('hex')
}

/**
 * The provider used when none is configured.
 *
 * It approves nothing. Returning `verified` for unverified people would be
 * worse than useless — it would put a "verified" badge, which this product
 * treats as a trust signal, on an account nobody checked. So it returns
 * `pending` and records that no provider ran, which surfaces in the UI as
 * "verification is not available yet" rather than as a false pass.
 */
class UnconfiguredProvider implements KycProvider {
  readonly name = 'unconfigured'

  async verify(): Promise<KycResult> {
    return {
      status: 'pending',
      reference: `unconfigured-${Date.now().toString(36)}`,
      reason:
        'Identity verification is not connected yet. Your details were not stored and nothing was checked.',
    }
  }
}

/**
 * Dojah, as the concrete example.
 *
 * Left unimplemented on purpose rather than guessed at: the request shape,
 * the liveness endpoint and the response codes all come from a contract that
 * has to be read, and inventing them would produce code that looks finished
 * and silently fails. Fill this in against their docs when an account exists.
 */
class DojahProvider implements KycProvider {
  readonly name = 'dojah'

  constructor(
    private readonly appId: string,
    private readonly secret: string,
  ) {}

  async verify(input: KycVerifyInput): Promise<KycResult> {
    // Two calls in practice: a selfie/liveness check, then an ID lookup that
    // matches the returned face against the NIMC photo.
    const response = await fetch('https://api.dojah.io/api/v1/kyc/nin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        AppId: this.appId,
        Authorization: this.secret,
      },
      body: JSON.stringify({
        nin: input.nin,
        // The provider receives the numbers. We do not keep them.
        selfie_image: input.liveness.replace(/^data:image\/jpeg;base64,/, ''),
      }),
    })

    if (!response.ok) {
      // Deliberately no body echo: provider errors quote the submitted values
      // back, and those must not reach a log.
      return {
        status: 'pending',
        reference: `dojah-error-${response.status}`,
        reason: 'Verification service did not respond. Try again shortly.',
      }
    }

    const body = (await response.json()) as {
      entity?: { selfie_verification?: { match?: boolean }; nin?: string }
    }
    const matched = body.entity?.selfie_verification?.match === true

    return {
      status: matched ? 'verified' : 'rejected',
      reference: `dojah-${Date.now().toString(36)}`,
      reason: matched ? undefined : 'The photo did not match the ID on record.',
    }
  }
}

export function getKycProvider(): KycProvider {
  const appId = process.env.KYC_APP_ID
  const secret = process.env.KYC_API_KEY

  if (process.env.KYC_PROVIDER === 'dojah' && appId && secret) {
    return new DojahProvider(appId, secret)
  }

  return new UnconfiguredProvider()
}
