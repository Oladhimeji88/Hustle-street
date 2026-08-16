import * as React from 'react'

/**
 * Shared shell for the legal documents.
 *
 * Legal copy is read differently from marketing copy: people arrive looking for
 * one clause, not to be persuaded. So this drops the wide marketing measure for
 * a single narrow column, numbers every section so a clause can be cited
 * ("see 4.2"), and puts the last-updated date at the top where someone checking
 * whether terms have changed will look for it.
 */
export function LegalDoc({
  updated,
  intro,
  sections,
}: {
  /** Human-readable date, e.g. "6 August 2026". */
  updated: string
  intro: React.ReactNode
  sections: { heading: string; body: React.ReactNode }[]
}) {
  return (
    <div className="gutter py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Last updated {updated}</p>

        <div className="mt-8 text-pretty leading-relaxed text-muted-foreground">{intro}</div>

        {/* Contents. Worth the space on a long document: it turns "scroll and
            skim" into "jump to the clause you came for". */}
        <nav aria-label="Contents" className="mt-12 border-y border-border py-6">
          <ol className="space-y-2.5">
            {sections.map((section, index) => (
              <li key={section.heading} className="flex gap-3 text-sm">
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground/60">
                  {index + 1}
                </span>
                <a
                  href={`#section-${index + 1}`}
                  className="link-underline text-foreground"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {sections.map((section, index) => (
            <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24">
              <h2 className="flex gap-3 text-h5">
                <span className="shrink-0 tabular-nums text-muted-foreground/50">{index + 1}</span>
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-pretty leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
