'use client'

import * as React from 'react'
import { motion, useReducedMotion, type Transition, type TargetAndTransition, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Entrance animation primitives.
 *
 * ── The vocabulary changed with the redesign ────────────────────────────────
 *
 * The previous set was built around long, soft entrances on an expo curve:
 * things faded up 24px over 0.9s, or resolved out of a 10px blur. That is the
 * house style of a soft, rounded, shadowed interface, and it no longer matches
 * a design language made of flat planes and hairlines.
 *
 * This set is physical instead. Its centrepiece is `fall`: a block drops in from
 * above, lands, squashes to 95%, overshoots to 102%, and settles. Staggered at
 * 60ms across a row it reads as a set of objects with real weight arriving on the
 * page — which is precisely why Mistral uses it for its block grids, and it is
 * the single most recognisable piece of motion on that site.
 *
 * The other effects follow the same logic. Directional entrances travel 60px
 * (far enough to read as arriving *from somewhere*, which a 16px nudge does not),
 * on `ease-out` over 0.7s. `reveal` wipes with a clip-path rather than moving —
 * the block is already in place and the paper is being pulled off it. Nothing
 * blurs: a blur is a soft edge, and this system has no soft edges.
 *
 * ── Timing ──────────────────────────────────────────────────────────────────
 *
 * Durations came down (0.5–0.7s from 0.8–1.1s) and the curves changed direction.
 * `fall` uses ease-IN, which is unusual for an entrance and load-bearing here:
 * the block accelerates downward like something dropped, instead of decelerating
 * into place like something being placed. That is the whole effect.
 */

/** Mistral's clip-path curve. The negative first control point is anticipation. */
const EASE_REVEAL = [0.51, -0.01, 0.49, 1] as const

/** Fast departure, long settle. For anything that slides. */
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const

export type RevealEffect = 'fade' | 'up' | 'fall' | 'reveal' | 'scale' | 'left' | 'right' | 'down'

type Effect = {
  hidden: TargetAndTransition
  shown: TargetAndTransition
  /** Per-effect timing. Overrides the caller's `duration` when it sets `times`. */
  transition?: Transition
  /** Extra classes the effect needs to work (e.g. a transform origin). */
  className?: string
}

const EFFECTS: Record<RevealEffect, Effect> = {
  // Plain opacity, linear. For things already in place that only need to arrive.
  fade: {
    hidden: { opacity: 0 },
    shown: { opacity: 1 },
    transition: { ease: 'linear' },
  },

  // The quiet workhorse. 8px — deliberately short, because in this system most
  // things are cells in a grid and a grid that slides looks like it is loading.
  up: {
    hidden: { opacity: 0, y: 8 },
    shown: { opacity: 1, y: 0 },
    transition: { ease: EASE_OUT_QUART },
  },

  // The signature. Drop, land, squash, overshoot, settle.
  //
  // `transformOrigin: bottom` is what makes the squash read as the block taking
  // its own weight on the surface rather than as a scale animation. It is applied
  // as a class rather than a style prop because `style` is stripped from this
  // component's prop surface — see DomProps below.
  fall: {
    hidden: { opacity: 0, y: -120, scaleY: 1 },
    shown: {
      opacity: [0, 1, 1, 1, 1],
      y: [-120, 0, 0, 0, 0],
      scaleY: [1, 1, 0.95, 1.02, 1],
    },
    transition: { duration: 0.55, times: [0, 0.5, 0.65, 0.8, 1], ease: 'easeIn' },
    className: 'origin-bottom',
  },

  // Clip-path wipe, rising slightly as it goes. For editorial blocks and images.
  reveal: {
    hidden: { opacity: 1, clipPath: 'polygon(0 0, 0 0, 0 0, 0 0)', y: 20 },
    shown: { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', y: 0 },
    transition: { duration: 1, ease: EASE_REVEAL },
  },

  // Snap up from nothing, with a touch of overshoot. Small elements only —
  // badges, marks, counters.
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    shown: { opacity: 1, scale: [0.94, 1.02, 1] },
    transition: { duration: 0.4, times: [0, 0.6, 1], ease: 'easeOut' },
  },

  left: {
    hidden: { opacity: 0, x: -60 },
    shown: { opacity: 1, x: 0 },
    transition: { duration: 0.7, ease: 'easeOut' },
  },
  right: {
    hidden: { opacity: 0, x: 60 },
    shown: { opacity: 1, x: 0 },
    transition: { duration: 0.7, ease: 'easeOut' },
  },
  down: {
    hidden: { opacity: 0, y: -60 },
    shown: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: 'easeOut' },
  },
}

/**
 * Builds the transition for an effect.
 *
 * The effect's own timing wins over the caller's `duration`. That matters for the
 * keyframed effects (`fall`, `scale`): their `times` arrays are fractions of a
 * specific duration, so letting a caller stretch it would desynchronise the
 * squash from the landing. Effects without their own duration accept whatever the
 * caller asks for.
 */
function transitionFor(effect: RevealEffect, duration: number, delay = 0): Transition {
  return { duration, ...EFFECTS[effect].transition, delay }
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
  /** Seconds. Ignored by the keyframed effects, which carry their own timing. */
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
  duration = 0.6,
  delay = 0,
  as = 'div',
  repeat = false,
  className,
  children,
  ...props
}: RevealProps) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  // Reduced motion: render in the final state, no transition at all.
  if (reduced) return <Comp className={className} {...props}>{children}</Comp>

  const { hidden, shown, className: effectClass } = EFFECTS[effect]

  return (
    <Comp
      initial={hidden}
      whileInView={shown}
      viewport={{ once: !repeat, amount: 0.15, margin: '0px 0px -10% 0px' }}
      transition={transitionFor(effect, duration, delay)}
      className={cn(effectClass, className)}
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
 *
 * The default stagger is 60ms, matching the interval Mistral uses across its
 * block grids. It is short enough that a row of eight still feels like one
 * gesture rather than eight separate events.
 */
export function RevealGroup({
  stagger = 0.06,
  delay = 0.05,
  as = 'div',
  repeat = false,
  effect = 'up',
  duration = 0.6,
  className,
  children,
  ...props
}: RevealProps & { stagger?: number }) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp className={className} {...props}>{children}</Comp>

  const container: Variants = {
    hidden: {},
    shown: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  }

  const { hidden, shown, className: effectClass } = EFFECTS[effect]
  const item: Variants = {
    hidden,
    shown: { ...shown, transition: transitionFor(effect, duration) },
  }

  const sequenced = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    // Only intrinsic elements can be swapped for a motion equivalent; a custom
    // component would need `motion.create()` and is left to opt in itself.
    if (typeof child.type !== 'string') return child

    const tag = child.type as keyof typeof motion
    const MotionTag = motion[tag] as React.ElementType
    const { children: inner, className: childClass, ...rest } = child.props as {
      children?: React.ReactNode
      className?: string
    }

    return (
      <MotionTag key={child.key} variants={item} className={cn(effectClass, childClass)} {...rest}>
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
      className={className}
      {...props}
    >
      {sequenced}
    </Comp>
  )
}

/** A single child of `<RevealGroup>`. Inherits the group's sequencing. */
export function RevealItem({
  effect = 'up',
  duration = 0.6,
  as = 'div',
  className,
  children,
  ...props
}: Omit<RevealProps, 'delay' | 'repeat'>) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp className={className} {...props}>{children}</Comp>

  const { hidden, shown, className: effectClass } = EFFECTS[effect]
  const item: Variants = {
    hidden,
    shown: { ...shown, transition: transitionFor(effect, duration) },
  }

  return (
    <Comp variants={item} className={cn(effectClass, className)} {...props}>
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
  stagger = 0.08,
  delay = 0.1,
  as = 'div',
  className,
  children,
  ...props
}: Omit<RevealProps, 'effect' | 'duration' | 'repeat'> & { stagger?: number }) {
  const reduced = useReducedMotion()
  const Comp = motion[as] as React.ElementType

  if (reduced) return <Comp className={className} {...props}>{children}</Comp>

  const container: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }

  return (
    <Comp initial="hidden" animate="shown" variants={container} className={className} {...props}>
      {children}
    </Comp>
  )
}
