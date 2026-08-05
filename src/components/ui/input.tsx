'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Form primitives.
 *
 * Every field wires up `aria-describedby` and `aria-invalid` automatically, so
 * a screen reader announces the error with the field rather than leaving it as
 * unattached red text somewhere on the page.
 */

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-0.5 text-destructive" aria-hidden="true">
        *
      </span>
    )}
  </LabelPrimitive.Root>
))
Label.displayName = 'Label'

const inputBase = cn(
  'flex w-full rounded-xl border border-input bg-surface px-3.5 text-foreground',
  'placeholder:text-muted-foreground/70',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25',
)

export interface InputProps
  // `prefix` and `suffix` already exist on InputHTMLAttributes as strings, so
  // the addon slots use distinct names rather than shadowing them.
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  /** Attached block before the field, e.g. the ₦ on a money input. */
  addonStart?: React.ReactNode
  addonEnd?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      invalid,
      leadingIcon,
      trailingIcon,
      addonStart,
      addonEnd,
      inputSize = 'md',
      ...props
    },
    ref,
  ) => {
    const heights = { sm: 'h-10 text-sm', md: 'h-12 text-[15px]', lg: 'h-14 text-base' }

    const field = (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBase,
          heights[inputSize],
          leadingIcon && 'pl-10',
          trailingIcon && 'pr-10',
          className,
        )}
        {...props}
      />
    )

    if (!leadingIcon && !trailingIcon && !addonStart && !addonEnd) return field

    return (
      <div className="relative flex items-stretch">
        {leadingIcon && (
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4.5"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}
        {addonStart && (
          <span
            className={cn(
              'inline-flex items-center rounded-l-xl border border-r-0 border-input bg-muted px-3.5 text-muted-foreground',
              heights[inputSize],
            )}
            aria-hidden="true"
          >
            {addonStart}
          </span>
        )}
        {React.cloneElement(field, {
          className: cn(
            field.props.className,
            addonStart && 'rounded-l-none',
            addonEnd && 'rounded-r-none',
          ),
        })}
        {addonEnd && (
          <span
            className={cn(
              'inline-flex items-center rounded-r-xl border border-l-0 border-input bg-muted px-3.5 text-muted-foreground',
              heights[inputSize],
            )}
            aria-hidden="true"
          >
            {addonEnd}
          </span>
        )}
        {trailingIcon && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4.5">
            {trailingIcon}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  /** Grows with content instead of showing a scrollbar. */
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, autoResize, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    const resize = React.useCallback(() => {
      const node = innerRef.current
      if (!node || !autoResize) return
      node.style.height = 'auto'
      node.style.height = `${node.scrollHeight}px`
    }, [autoResize])

    React.useEffect(resize, [resize, props.value])

    return (
      <textarea
        ref={setRefs}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          onChange?.(event)
          resize()
        }}
        className={cn(
          inputBase,
          'min-h-[110px] resize-y py-3 text-[15px] leading-relaxed',
          autoResize && 'resize-none overflow-hidden',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export interface FieldProps {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  /** Live character count, e.g. "120 / 5000". */
  counter?: { current: number; max: number }
  children: React.ReactNode
  className?: string
}

/**
 * Wraps a control with its label, hint, error and counter, and generates the
 * ARIA wiring between them.
 */
function Field({ label, htmlFor, hint, error, required, counter, children, className }: FieldProps) {
  const generatedId = React.useId()
  const fieldId = htmlFor ?? generatedId
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={fieldId} required={required}>
            {label}
          </Label>
          {counter && (
            <span
              className={cn(
                'text-xs tabular-nums',
                counter.current > counter.max ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {counter.current} / {counter.max}
            </span>
          )}
        </div>
      )}

      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: fieldId,
            'aria-describedby': describedBy,
            ...(error ? { invalid: true } : {}),
          })
        : children}

      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-destructive"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export { Input, Textarea, Label, Field }
