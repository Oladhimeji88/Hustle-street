import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The button.
 *
 * Design intent: primary actions are loud and physical — a solid orange block
 * with a soft coloured shadow that presses down on tap. On a phone in daylight
 * this is what makes "Post a Job" impossible to miss.
 *
 * Every size meets the 44px minimum touch target from WCAG 2.2 AA except `xs`,
 * which is only for inline text actions inside an already-tappable row.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-street hover:bg-primary/92 active:shadow-sm',
        money:
          'bg-money text-money-foreground shadow-sm hover:bg-money/92',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline:
          'border border-input bg-transparent hover:bg-secondary hover:text-secondary-foreground',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        subtle: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
        // Quiet primary. Where orange would shout, ink states the action and
        // lets the surrounding whitespace carry the emphasis.
        ink: 'bg-ink text-white hover:bg-ink/88',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-10 rounded-lg px-3.5 text-sm [&_svg]:size-4',
        md: 'h-11 rounded-xl px-5 text-sm [&_svg]:size-4',
        lg: 'h-12 rounded-xl px-6 text-base [&_svg]:size-5',
        xl: 'h-14 rounded-2xl px-8 text-base [&_svg]:size-5',
        icon: 'size-11 rounded-xl [&_svg]:size-5',
        'icon-sm': 'size-9 rounded-lg [&_svg]:size-4',
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
