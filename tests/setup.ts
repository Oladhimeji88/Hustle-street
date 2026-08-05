import '@testing-library/jest-dom/vitest'

// Deterministic environment for every test run: the app is built for Lagos, so
// tests assert against Lagos time and Nigerian formatting.
process.env.TZ = 'Africa/Lagos'
process.env.NEXT_PUBLIC_APP_ENV = 'development'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-000000000000000000'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-000000000000000'
process.env.CRON_SECRET = 'test-cron-secret-at-least-24-chars'
