// Tremor Checkbox [v0.0.1]

import * as CheckboxPrimitives from "@radix-ui/react-checkbox"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitives.Root>,
  Omit<
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>,
    "asChild"
  >
>(({ className, checked, ...props }, forwardedRef) => {
  return (
    <CheckboxPrimitives.Root
      ref={forwardedRef}
      checked={checked}
      className={cx(
        // base
        "relative inline-flex size-4 shrink-0 appearance-none items-center justify-center rounded border shadow-sm outline-none transition duration-100",
        // border color
        "border-gray-300 dark:border-gray-800",
        // background color
        "bg-white dark:bg-gray-950",
        // checked
        "data-[state=checked]:border-0 data-[state=checked]:border-transparent data-[state=checked]:bg-blue-500",
        "data-[state=indeterminate]:border-0 data-[state=indeterminate]:border-transparent data-[state=indeterminate]:bg-blue-500",
        // disabled
        "data-[disabled]:border data-[disabled]:border-gray-300 data-[disabled]:bg-gray-100 data-[disabled]:text-gray-400",
        "data-[disabled]:dark:border-gray-700 data-[disabled]:dark:bg-gray-800",
        focusRing,
        className,
      )}
      tremor-id="tremor-raw"
      {...props}
    >
      <CheckboxPrimitives.Indicator className="flex size-full items-center justify-center text-white dark:text-white">
        {checked === "indeterminate" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            className="size-3"
          >
            <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            className="size-3"
          >
            <path
              d="M2 6.5L4.5 9L10 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
