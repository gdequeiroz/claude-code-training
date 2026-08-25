"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Card, CardCategory, Currency } from "@/data/types"
import { maskCard } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { cx } from "@/lib/utils"
import { Check, Copy, Plus, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

/**
 * Issue a virtual card, then show its number exactly once.
 *
 * The number lives in this component's state for the life of the success
 * screen and is cleared when it closes. It is never written anywhere, and
 * the server has no field to hand it back from — closing this really is
 * the last time anyone sees it.
 */

const CATEGORY_LABELS: Record<NonNullable<CardCategory>, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

type Merchant = { id: string; name: string; currency: Currency }

export function IssueCardDialog({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const fieldId = useId()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<string>("none")

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; cardNumber: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  // One key per attempt at one card. Retrying a failed submit reuses it, so
  // a double-click or a flaky connection cannot issue two cards.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const limitMinorUnits = parseAmountToMinorUnits(limit)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("none")
    setErrors({})
    setFormError(null)
    setIssued(null)
    setCopied(false)
    setIdempotencyKey(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Closing drops the revealed number out of memory along with everything
    // else. Reopening starts a fresh card, never a fresh look at this one.
    if (!next) {
      if (issued) router.refresh()
      reset()
    }
  }

  // Picking a merchant defaults the currency to theirs — the console already
  // knows what a merchant settles in, and mismatches are how the wrong card
  // gets issued.
  const onMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (limitMinorUnits === null) {
      setErrors({ spendLimit: "Enter an amount like 250 or 250.00." })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit: limitMinorUnits,
          currency,
          category: category === "none" ? null : category,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors(data.errors ?? {})
        setFormError(data.errors ? null : (data.message ?? "That did not work."))
        return
      }

      if (data.replayed) {
        setFormError(data.message)
        return
      }

      setErrors({})
      setIssued({ card: data.card, cardNumber: data.cardNumber })
    } catch {
      setFormError("Could not reach the server. Nothing was issued.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`${fieldId}-${name}-error`} className="mt-1 text-sm text-red-600 dark:text-red-500">
        {errors[name]}
      </p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DialogTrigger>

      <DialogContent>
        {issued ? (
          <RevealOnce
            card={issued.card}
            cardNumber={issued.cardNumber}
            copied={copied}
            onCopy={() => {
              navigator.clipboard?.writeText(issued.cardNumber)
              setCopied(true)
            }}
          />
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Issue a virtual card</DialogTitle>
              <DialogDescription>
                The number is shown once, right after it is created. Nobody can
                read it back afterwards.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor={`${fieldId}-nickname`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id={`${fieldId}-nickname`}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Meta"
                  className="mt-1.5"
                  hasError={Boolean(errors.nickname)}
                  aria-describedby={
                    errors.nickname ? `${fieldId}-nickname-error` : undefined
                  }
                />
                {fieldError("nickname")}
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-merchant`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={onMerchantChange}>
                  <SelectTrigger id={`${fieldId}-merchant`} className="mt-1.5">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("merchantId")}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor={`${fieldId}-limit`}
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id={`${fieldId}-limit`}
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="2500.00"
                    className="mt-1.5"
                    hasError={Boolean(errors.spendLimit)}
                    aria-describedby={
                      errors.spendLimit ? `${fieldId}-spendLimit-error` : undefined
                    }
                  />
                  {fieldError("spendLimit")}
                  {limitMinorUnits !== null && !errors.spendLimit && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                      {formatMoney(limitMinorUnits, currency)} ·{" "}
                      {limitMinorUnits.toLocaleString()} minor units
                    </p>
                  )}
                </div>

                <div className="w-28">
                  <label
                    htmlFor={`${fieldId}-currency`}
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v as Currency)}
                  >
                    <SelectTrigger id={`${fieldId}-currency`} className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError("currency")}
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-category`}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id={`${fieldId}-category`} className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {(
                      Object.keys(CATEGORY_LABELS) as NonNullable<CardCategory>[]
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("category")}
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            )}

            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="py-1.5">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className="py-1.5" isLoading={submitting}>
                Issue card
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The one and only time this number is on a screen. */
function RevealOnce({
  card,
  cardNumber,
  copied,
  onCopy,
}: {
  card: Card
  cardNumber: string
  copied: boolean
  onCopy: () => void
}) {
  const grouped = cardNumber.replace(/(.{4})/g, "$1 ").trim()

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Card issued</DialogTitle>
        <DialogDescription>
          Copy the number now. This is the only time it will be shown —
          everywhere else it reads {maskCard(card.last4)}.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {card.nickname}
        </p>
        <p className="mt-2 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
          {grouped}
        </p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
          {formatMoney(card.spendLimit, card.currency)} limit · {card.currency}
        </p>
      </div>

      <p
        className={cx(
          "mt-4 flex items-start gap-2 rounded-md border p-3 text-sm",
          "border-amber-200 bg-amber-50 text-amber-800",
          "dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
        )}
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Closing this dialog discards the number. It is not stored and cannot be
        shown again.
      </p>

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="secondary"
          className="gap-2 py-1.5"
          onClick={onCopy}
        >
          {copied ? (
            <Check className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Copy className="size-4 shrink-0" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy number"}
        </Button>
        <DialogClose asChild>
          <Button type="button" className="py-1.5">
            Done
          </Button>
        </DialogClose>
      </DialogFooter>
    </div>
  )
}
