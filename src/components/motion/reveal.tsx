'use client'

import * as React from 'react'
import { motion, useReducedMotion, type TargetAndTransition, type Variants } from 'motion/react'

/**
 * Entrance animation primitives.
 *
 * These replace a hand-rolled IntersectionObserver + CSS-transition setup. The
 * observer version worked, but it could only ever do what a CSS transition can:
 * no spring physics, no per-child orchestration, no interruption handling, and
 * `filter: blur()` transitions that janked on mid-range Android. Motion is the
 * library Framer itself is built on, so the vocabulary below is the same one
 * Framer's "Appear" effects use.
 *
 * ── Timing ──────────────────────────────────────────────────────────────────
 *
 * `EASE_OUT_EXPO` is the curve Framer reaches for on entrances: almost all of
 * the distance is covered in the first third, then it settles. That is what
 * makes a slow animation read as *considered* rather than sluggish — the eye
 * registers the movement immediately and the tail is just the element coming
 * to rest.
 *
 * Durations here are deliberately long (0.8–1.1s). Fast entrances draw
 * attention to the fact that something animated; slow ones on this curve are
 * felt more than seen.
 */

/** Framer's entrance curve. Sharp departure, long settle. */
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

/** For elements that move a longer distance and need a touch more weight. */
const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const

export type RevealEffect = 'fade' | 'up' | 'blur' | 'scale' | 'left' | 'right'

const EFFECTS: Record<RevealEffect, { hidden: TargetAndTransition; shown: TargetAndTransition }> = {
  // Plain opacity. For things that are already in place and only need to arrive.
  fade: {
    hidden: { opacity: 0 },
    shown: { opacity: 1 },
  },
  // The workhorse: rise and fade. 24px is far enough to read as motion and
  // short enough that it never looks like the layout is settling.
  up: {
    hidden: { opacity: 0, y: 24 },
    shown: { opacity: 1, y: 0 },
  },
  // Framer's signature. The blur does most of the work — it reads as the
  // element resolving into focus rather than sliding in from somewhere.
  blur: {
    hidden: { opacity: 0, y: 16, filter: 'blur(10px)' },
    shown: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
  // For panels and cards that should feel like they are coming forward.
  scale: {
    hidden: { opacity: 0, scale: 0.96, y: 12 },
    shown: { opacity: 1, scale: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -28 },
    shown: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 28 },
    shown: { opacity: 1, x: 0 },
  },
}

/**
 * React's DOM drag/animation handlers and Motion's gesture props share names but
 * not signatures (`onDrag` is a `DragEvent` handler in one and a pan callback in
 * the other), so they are dropped here rather than fought with. Nothing in this
 * codebase passes them to a Reveal, and a component that needs them should use
 * `motion.*` directly.
 */
type DomProps = Omit<
  React.ComponentProps<'div'>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDrop'
  | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'style' | 'ref'
>

interface RevealProps extends DomProps {
  effect?: RevealEffect
  /** Seconds. Long by default — see the timing note above. */
  duration?: number
  /** Seconds to wait before starting. */
  delay?: number
  /** Render as a different element (`ul`, `section`, …). */
  as?: 'div' | 'section' | 'ul' | 'ol' | 'li' | 'span' | 'p'
  /** Re-run every time it scrolls into view. Off by default: a reveal that
   *  re-fires on the way back up is a distraction, not a delight. */
  repeat?: boolean
}

/**
 * Animates once when it scrolls into view.
 *
 * `amount: 0.15` fires when 15% is visible, and the negative bottom margin
 * starts it slightly before the element reaches the fold, so the motion has
 * finished by the time it is properly in view.
 */
export function Reveal({
  effect = 'up',
  duration = 0.9,
  delay = 0,
  as = 'div',
  repeat = false,
  children,
  ...props
}: RevealProps) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  // Reduced motion: render in the final state, no transition at all.
  if (reduced) return <Comp {...props}>{children}</Comp>

  const { hidden, shown } = EFFECTS[effect]

  return (
    <Comp
      initial={hidden}
      whileInView={shown}
      viewport={{ once: !repeat, amount: 0.15, margin: '0px 0px -10% 0px' }}
      transition={{ duration, delay, ease: EASE_OUT_EXPO }}
      {...props}
    >
      {children}
    </Comp>
  )
}

/**
 * Container that sequences its children.
 *
 * Children are upgraded automatically: each direct child element is re-created
 * as its Motion equivalent (`li` → `motion.li`) with the item variant attached.
 * Wrapping them in a `<div>` instead would have been simpler and wrong — it
 * puts a non-`li` between a `ul` and its items, which breaks both the list
 * semantics screen readers rely on and any `grid` layout on the parent.
 *
 * A child that is already a Motion component, or any non-element (a string, a
 * conditional `null`), is passed through untouched.
 */
export function RevealGroup({
  stagger = 0.12,
  delay = 0.05,
  as = 'div',
  repeat = false,
  effect = 'up',
  duration = 0.8,
  children,
  ...props
}: RevealProps & { stagger?: number }) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp {...props}>{children}</Comp>

  const container: Variants = {
    hidden: {},
    shown: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  }

  const { hidden, shown } = EFFECTS[effect]
  const item: Variants = {
    hidden,
    shown: { ...shown, transition: { duration, ease: EASE_OUT_QUINT } },
  }

  const sequenced = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    // Only intrinsic elements can be swapped for a motion equivalent; a custom
    // component would need `motion.create()` and is left to opt in itself.
    if (typeof child.type !== 'string') return child

    const tag = child.type as keyof typeof motion
    const MotionTag = motion[tag] as React.ElementType
    const { children: inner, ...rest } = child.props as { children?: React.ReactNode }

    return (
      <MotionTag key={child.key} variants={item} {...rest}>
        {inner}
      </MotionTag>
    )
  })

  return (
    <Comp
      initial="hidden"
      whileInView="shown"
      viewport={{ once: !repeat, amount: 0.1, margin: '0px 0px -8% 0px' }}
      variants={container}
      {...props}
    >
      {sequenced}
    </Comp>
  )
}

/** A single child of `<RevealGroup>`. Inherits the group's sequencing. */
export function RevealItem({
  effect = 'up',
  duration = 0.8,
  as = 'div',
  children,
  ...props
}: Omit<RevealProps, 'delay' | 'repeat'>) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp {...props}>{children}</Comp>

  const { hidden, shown } = EFFECTS[effect]
  const item: Variants = {
    hidden,
    shown: { ...shown, transition: { duration, ease: EASE_OUT_QUINT } },
  }

  return (
    <Comp variants={item} {...props}>
      {children}
    </Comp>
  )
}

/**
 * Above-the-fold entrance. Same vocabulary, but plays on mount rather than on
 * scroll — the hero is already in view, so waiting for an intersection would
 * mean it never animates at all.
 */
export function RevealOnMount({
  stagger = 0.1,
  delay = 0.1,
  as = 'div',
  children,
  ...props
}: Omit<RevealProps, 'effect' | 'duration' | 'repeat'> & { stagger?: number }) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp {...props}>{children}</Comp>

  const container: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }

  return (
    <Comp initial="hidden" animate="shown" variants={container} {...props}>
      {children}
    </Comp>
  )
}
