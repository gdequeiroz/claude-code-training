"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel from wherever a card is shown.
 *
 * The buttons a card cannot use are hidden, but that is a convenience —
 * the server owns the state machine and answers 409 to anything illegal,
 * which is what this surfaces when it happens.
 */
export function CardActions({
  cardId,
  status,
  size = "sm",
}: {
  cardId: string
  status: CardStatus
  size?: "sm" | "md"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function move(to: CardStatus) {
    setError(null)
    setBusy(to)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "That change was refused.")
        return
      }
      // Re-render the server component in place. No full page reload.
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server. Nothing changed.")
    } finally {
      setBusy(null)
    }
  }

  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-400 dark:text-gray-600">
        No actions
      </span>
    )
  }

  const className = size === "sm" ? "py-1 text-xs" : "py-1.5"

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className={className}
          isLoading={busy !== null && busy !== "cancelled"}
          disabled={pending}
          onClick={() => move(status === "active" ? "frozen" : "active")}
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </Button>
        <Button
          variant="ghost"
          className={`${className} text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/40`}
          isLoading={busy === "cancelled"}
          disabled={pending}
          onClick={() => move("cancelled")}
        >
          Cancel card
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
