import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getCurrentUser } from '@/lib/supabase/server'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(user)} />
      {/*
       * `.ruled` is the site's spine — a 1728px column with a hairline down each
       * side. Applying it here rather than per-section is what makes the two
       * vertical rules continuous from the header to the footer instead of
       * restarting at every band. Sections inside only supply their own bottom
       * rule and their gutter.
       */}
      <main id="main" className="ruled flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
