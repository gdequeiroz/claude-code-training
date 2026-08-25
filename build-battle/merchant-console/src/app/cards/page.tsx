import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { Wallet } from "lucide-react"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-dialog"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Single-merchant cards for vendor subscriptions, ad spend, and
            contractor tools.
          </p>
        </div>
        <IssueCardDialog
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
        />
      </div>

      {cards.length === 0 ? (
        <div className="border-t border-gray-200 px-4 py-20 text-center dark:border-gray-800">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900">
            <Wallet
              className="size-5 text-gray-500 dark:text-gray-500"
              aria-hidden="true"
            />
          </span>
          <p className="mt-3 font-medium text-gray-900 dark:text-gray-50">
            No cards issued yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-500">
            Issue one and its number is shown once, right after it is created.
            After that the console keeps only the last four.
          </p>
        </div>
      ) : (
        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nickname</TableHeaderCell>
                <TableHeaderCell>Merchant</TableHeaderCell>
                <TableHeaderCell>Number</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Spend limit
                </TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {card.nickname}
                    </Link>
                    {card.category && (
                      <span className="ml-2 text-xs capitalize text-gray-500 dark:text-gray-500">
                        {card.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                  <TableCell className="font-mono tabular-nums text-gray-500">
                    {maskCard(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <CardActions cardId={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      )}
    </section>
  )
}
