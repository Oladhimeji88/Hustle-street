'use client'

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react'

/**
 * Toasts.
 *
 * Positioned top-centre on mobile so they never collide with the bottom
 * navigation or the iOS home indicator, and bottom-right on desktop where the
 * eye expects transient feedback.
 */
function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={12}
      gap={8}
      duration={4000}
      visibleToasts={3}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group flex items-center gap-3 w-full rounded-2xl border border-border bg-surface p-4 shadow-lg text-foreground',
          title: 'text-sm font-semibold leading-snug',
          description: 'text-sm text-muted-foreground leading-relaxed',
          actionButton: 'rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground',
          cancelButton: 'rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold',
          closeButton: 'border-border bg-surface text-muted-foreground',
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-5 text-money" />,
        error: <XCircle className="size-5 text-destructive" />,
        warning: <TriangleAlert className="size-5 text-warning" />,
        info: <Info className="size-5 text-primary" />,
      }}
    />
  )
}

/**
 * Product-voice toast helpers.
 *
 * These wrap sonner so the copy stays consistent — "Job posted", not
 * "Operation completed successfully".
 */
const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),

  error: (message: string, description?: string) => sonnerToast.error(message, { description }),

  info: (message: string, description?: string) => sonnerToast.info(message, { description }),

  warning: (message: string, description?: string) => sonnerToast.warning(message, { description }),

  /** For actions the user can undo, e.g. unsaving a job. */
  undo: (message: string, onUndo: () => void) =>
    sonnerToast(message, {
      action: { label: 'Undo', onClick: onUndo },
      duration: 6000,
    }),

  /** Shown by the network-status watcher when the connection drops. */
  offline: () =>
    sonnerToast.warning("You're offline", {
      description: 'Some features are unavailable. Anything you send will go out when you reconnect.',
      id: 'network-offline',
      duration: Number.POSITIVE_INFINITY,
    }),

  backOnline: () => {
    sonnerToast.dismiss('network-offline')
    sonnerToast.success('Back online', { description: 'Syncing your latest changes.' })
  },

  /** Persistent prompt used for service-worker updates. */
  update: (message: string, description: string, onReload: () => void) =>
    sonnerToast(message, {
      description,
      duration: 20_000,
      action: { label: 'Reload', onClick: onReload },
    }),

  /** Ties a toast to an in-flight promise. */
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string },
  ) => sonnerToast.promise(promise, messages),

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
}

export { Toaster, toast }
