"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
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
import { Check, Copy, Plus, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

/**
 * Issue a virtual card, then show its number exactly once.
 *
 * The number lives in this component's state for the life of the success
 * screen and is dropped when it closes. It is never written anywhere, and
 * the server has no field to hand it back from, so closing really is the
 * last time anyone sees it.
 */

const CATEGORIES: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

type Merchant = { id: string; name: string; currency: Currency }

/** Label, control, and the server's message for one field. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-900 dark:text-gray-50"
      >
        {label}
        {hint && <span className="font-normal text-gray-500"> {hint}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

export function IssueCardDialog({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const uid = useId()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState("none")

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; cardNumber: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // One key per attempt at one card. A retry reuses it, so a double-click
  // or a flaky connection cannot issue two cards.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const minorUnits = parseAmountToMinorUnits(limit)
  const field = (name: string) => `${uid}-${name}`
  const describedBy = (name: string) =>
    errors[name] ? `${field(name)}-error` : undefined

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) return
    // Closing drops the revealed number along with everything else.
    // Reopening starts a new card, never a second look at this one.
    if (issued) router.refresh()
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

  // A card settles in its merchant's currency, and the server enforces that.
  // Defaulting it here means ops does not have to find out by being rejected.
  const onMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (minorUnits === null) {
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
          spendLimit: minorUnits,
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent>
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
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The number is shown once, right after it is created. Nobody can
                read it back afterwards.
              </DrawerDescription>
            </DrawerHeader>

            <div className="mt-6 space-y-4">
              <Field id={field("nickname")} label="Nickname" error={errors.nickname}>
                <Input
                  id={field("nickname")}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Meta"
                  hasError={Boolean(errors.nickname)}
                  aria-describedby={describedBy("nickname")}
                />
              </Field>

              <Field id={field("merchant")} label="Merchant" error={errors.merchantId}>
                <Select value={merchantId} onValueChange={onMerchantChange}>
                  <SelectTrigger id={field("merchant")}>
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Field
                    id={field("spendLimit")}
                    label="Spend limit"
                    error={errors.spendLimit}
                  >
                    <Input
                      id={field("spendLimit")}
                      inputMode="decimal"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="2500.00"
                      hasError={Boolean(errors.spendLimit)}
                      aria-describedby={describedBy("spendLimit")}
                    />
                  </Field>
                  {minorUnits !== null && !errors.spendLimit && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                      {formatMoney(minorUnits, currency)} ·{" "}
                      {minorUnits.toLocaleString()} minor units
                    </p>
                  )}
                </div>

                <div className="w-28">
                  <Field id={field("currency")} label="Currency" error={errors.currency}>
                    <Select
                      value={currency}
                      onValueChange={(v) => setCurrency(v as Currency)}
                    >
                      <SelectTrigger id={field("currency")}>
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
                  </Field>
                </div>
              </div>

              <Field
                id={field("category")}
                label="Category lock"
                hint="(optional)"
                error={errors.category}
              >
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id={field("category")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {(Object.keys(CATEGORIES) as CardCategory[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORIES[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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

            <DrawerFooter className="mt-6">
              <DrawerClose asChild>
                <Button type="button" variant="secondary" className="py-1.5">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" className="py-1.5" isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
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
  return (
    <div>
      <DrawerHeader>
        <DrawerTitle>Card issued</DrawerTitle>
        <DrawerDescription>
          Copy the number now. This is the only time it will be shown —
          everywhere else it reads {maskCard(card.last4)}.
        </DrawerDescription>
      </DrawerHeader>

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {card.nickname}
        </p>
        <p className="mt-2 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
          {cardNumber.replace(/(.{4})/g, "$1 ").trim()}
        </p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-500">
          {formatMoney(card.spendLimit, card.currency)} limit · {card.currency}
        </p>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Closing this panel discards the number. It is not stored and cannot be
        shown again.
      </p>

      <DrawerFooter className="mt-6">
        <Button type="button" variant="secondary" className="gap-2 py-1.5" onClick={onCopy}>
          {copied ? (
            <Check className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Copy className="size-4 shrink-0" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy number"}
        </Button>
        <DrawerClose asChild>
          <Button type="button" className="py-1.5">
            Done
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </div>
  )
}
