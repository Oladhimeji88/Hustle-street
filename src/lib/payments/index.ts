import 'server-only'

import { getServerEnv } from '@/lib/config/env'
import { PaystackProvider } from './paystack'
import type { PaymentProvider } from './types'

export * from './types'

/**
 * Provider registry.
 *
 * The active provider is chosen by env, not by an import, so switching (or
 * running Paystack in NG and something else elsewhere) is a configuration
 * change. Instances are memoised — they are stateless HTTP clients.
 */
const registry = new Map<string, PaymentProvider>()

function instantiate(name: string): PaymentProvider {
  switch (name) {
    case 'paystack':
      return new PaystackProvider()
    // A second provider is added here and in the PAYMENT_PROVIDER enum in
    // src/lib/config/env.ts. Nothing else in the codebase needs to change.
    default:
      throw new Error(`Unknown payment provider: ${name}`)
  }
}

export function getPaymentProvider(name?: string): PaymentProvider {
  const providerName = name ?? getServerEnv().PAYMENT_PROVIDER

  let provider = registry.get(providerName)
  if (!provider) {
    provider = instantiate(providerName)
    registry.set(providerName, provider)
  }

  return provider
}
