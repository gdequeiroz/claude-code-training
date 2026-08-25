// Tremor Dialog [v0.0.1]

import * as DialogPrimitives from "@radix-ui/react-dialog"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

/** The primitive components.md already describes. Radix dialog was already a dependency. */

const Dialog = (
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitives.Root>,
) => <DialogPrimitives.Root tremor-id="tremor-raw" {...props} />

const DialogTrigger = DialogPrimitives.Trigger
const DialogClose = DialogPrimitives.Close

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Portal>
    <DialogPrimitives.Overlay
      className={cx(
        "fixed inset-0 z-50 overflow-y-auto bg-black/70",
        "data-[state=open]:animate-dialogOverlayShow data-[state=closed]:animate-hide",
      )}
    >
      <DialogPrimitives.Content
        ref={ref}
        className={cx(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border p-6 shadow-lg",
          "border-gray-200 bg-white dark:border-gray-900 dark:bg-[#090E1A]",
          "data-[state=open]:animate-dialogContentShow",
          focusRing,
          className,
        )}
        {...props}
      />
    </DialogPrimitives.Overlay>
  </DialogPrimitives.Portal>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => (
  <div className={cx("flex flex-col gap-y-1", className)} {...props} />
)

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Title
    ref={ref}
    className={cx(
      "text-base font-semibold text-gray-900 dark:text-gray-50",
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Description
    ref={ref}
    className={cx("text-sm text-gray-500 dark:text-gray-500", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => (
  <div
    className={cx(
      "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
      className,
    )}
    {...props}
  />
)

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
