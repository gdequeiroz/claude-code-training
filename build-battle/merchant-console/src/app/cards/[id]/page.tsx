import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.spendLimit - card.spent
  // Integer minor units throughout; the percentage is display only.
  const usedPercent =
    card.spendLimit > 0
      ? Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
      : 0
  const nearLimit = usedPercent >= 80

  const facts: { label: string; value: string; capitalize?: boolean }[] = [
    { label: "Merchant", value: merchant.name },
    { label: "Number", value: maskCard(card.last4) },
    {
      label: "Spend limit",
      value: formatMoney(card.spendLimit, card.currency),
    },
    { label: "Currency", value: card.currency },
    {
      label: "Category lock",
      value: card.category ?? "None",
      capitalize: true,
    },
    { label: "Card ID", value: card.id },
    {
      label: "Issued",
      value: formatInZone(card.createdAt, merchant.timezone),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← Cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <CardStatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm tabular-nums text-gray-500 dark:text-gray-500">
            {maskCard(card.last4)} · {merchant.name}
          </p>
        </div>
        <CardActions cardId={card.id} status={card.status} size="md" />
      </div>

      <Divider />

      <section aria-label="Spend against limit">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500 dark:text-gray-500">
            {formatMoney(remaining, card.currency)} remaining
          </p>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </span>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${usedPercent}% of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              nearLimit
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${usedPercent}%` }}
          />
        </div>

        <p
          className={cx(
            "mt-2 text-sm tabular-nums",
            nearLimit
              ? "text-amber-700 dark:text-amber-500"
              : "text-gray-500 dark:text-gray-500",
          )}
        >
          {usedPercent}% used
          {nearLimit && " · close to the limit"}
        </p>
      </section>

      <Divider />

      <section aria-label="Card record">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Record
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex justify-between gap-4 border-b border-gray-100 pb-2 dark:border-gray-900"
            >
              <dt className="text-sm text-gray-500 dark:text-gray-500">
                {fact.label}
              </dt>
              <dd
                className={cx(
                  "text-sm text-gray-900 dark:text-gray-50",
                  fact.capitalize && "capitalize",
                )}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Divider />

      <section aria-label="History">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          History
        </h2>
        <ol className="mt-3 space-y-3">
          {card.events.map((event, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700"
                aria-hidden="true"
              />
              <div>
                <p className="text-gray-900 dark:text-gray-50">{event.note}</p>
                <p className="text-gray-500 dark:text-gray-500">
                  {formatInZone(event.at, merchant.timezone)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
