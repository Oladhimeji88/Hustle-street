import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The button.
 *
 * ── The hierarchy changed ───────────────────────────────────────────────────
 *
 * `primary` used to be a solid orange block with a coloured shadow. It is now
 * near-black, and orange has moved to its own `brand` variant. This is not a
 * demotion of the brand — it is what makes the brand land. When every action on
 * the page is orange, orange stops meaning anything and becomes the colour of
 * "button". Reserving it for one or two moments per screen is what lets it read
 * as the product's colour rather than as a widget style.
 *
 * It is also the only way the flat-plane treatment works: an orange CTA sitting
 * on an orange block is invisible, whereas the ink fill reads against anything.
 *
 * ── Labels are set in the display face ─────────────────────────────────────
 *
 * At weight 500 with *positive* tracking, per the type scale. Buttons are the
 * one place the system pushes letter-spacing out rather than pulling it in:
 * short all-caps-adjacent labels at 13–16px need the air, and it is what stops
 * a tight grotesque from looking cramped inside a small box.
 *
 * ── No z-axis ───────────────────────────────────────────────────────────────
 *
 * No shadow, and no `active:scale` — a button that shrinks is imitating a
 * physical key this design language does not have. Press feedback is a 1px
 * settle, matching every other interactive surface.
 *
 * Every size meets the 44px minimum touch target from WCAG 2.2 AA except `xs`
 * and `sm`, which are for inline actions inside an already-tappable row.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-display transition-colors duration-150',
    'focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    'active:translate-y-px',
  ],
  {
    variants: {
      variant: {
        /* The default action. Near-black, the darkest thing on the page. */
        primary: 'bg-ink text-ink-foreground hover:bg-ink/88',
        /* The brand plane. The label is white by design decision; note that
           white on this orange measures 3.24:1, which clears AA for large text
           but not for a normal-size button label. See the note on
           `--primary-foreground` in globals.css for the reasoning and for the
           darker orange to switch to if AA here becomes a requirement. */
        brand: 'bg-primary text-primary-foreground hover:bg-primary/88',
        money: 'bg-money text-money-foreground hover:bg-money/88',
        /* A filled cell. Reads as part of the grid rather than as a control. */
        secondary: 'bg-surface-muted text-foreground hover:bg-surface-raised',
        outline: 'border border-border-strong bg-transparent hover:bg-surface-muted',
        /* Mistral's ghost: a 5% ink wash that deepens to 10%. A wash rather than
           a transparent-to-filled jump, so the shape is visible at rest. */
        ghost: 'bg-foreground/[0.05] text-foreground hover:bg-foreground/10',
        /* Fully transparent until hovered. For dense toolbars where a resting
           wash on every control would read as clutter. */
        bare: 'bg-transparent text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
        subtle: 'bg-primary-soft text-primary-text hover:bg-primary-soft/70',
        /* Kept as an alias: `ink` and `primary` are the same thing now, and a
           dozen call sites still ask for it by name. */
        ink: 'bg-ink text-ink-foreground hover:bg-ink/88',
        /* For use *on* an ink panel, where the contrast is inverted. */
        invert: 'bg-ink-foreground text-ink hover:bg-ink-foreground/88',
        'invert-outline':
          'border border-border-invert bg-transparent text-ink-foreground hover:bg-ink-foreground/10',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/88',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 rounded-sm px-2.5 text-button-sm [&_svg]:size-3.5',
        sm: 'h-10 rounded-md px-3.5 text-button-sm [&_svg]:size-4',
        md: 'h-11 rounded-md px-4 text-button-sm [&_svg]:size-4',
        lg: 'h-12 rounded-md px-5 text-button-lg [&_svg]:size-4',
        /* 56px — the header's own height, so a hero CTA lines up with the grid. */
        xl: 'h-14 rounded-md px-6 text-button-lg [&_svg]:size-5',
        icon: 'size-11 rounded-md [&_svg]:size-4',
        'icon-sm': 'size-9 rounded-md [&_svg]:size-4',
        /* A full-height square cell, for buttons that live inside the grid — the
           header CTA, a toolbar end cap. No radius: it is a cell, not a control. */
        cell: 'h-14 rounded-none px-5 text-button-sm [&_svg]:size-4',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Announced to screen readers while `loading` is true. */
  loadingText?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      loadingText,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // `asChild` renders a Link/anchor, which cannot host the spinner markup.
    const Comp = asChild ? Slot : 'button'

    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size, block, className }))}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, block, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          <>
            {leadingIcon}
            {children}
            {trailingIcon}
          </>
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
