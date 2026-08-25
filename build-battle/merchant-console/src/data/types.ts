export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

/** active ⇄ frozen, either to cancelled, and cancelled is terminal. */
export type CardStatus = "active" | "frozen" | "cancelled"

/** What a card is allowed to be spent on. Null means no lock. */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "utilities"

export interface Merchant {
  id: string
  name: string
  country: string
  /** IANA timezone. Display converts to this; storage never does. */
  timezone: string
  currency: Currency
  riskTier: "low" | "standard" | "elevated"
}

export interface Payment {
  id: string
  merchantId: string
  /** Integer minor units. Never a float. */
  amount: number
  currency: Currency
  status: PaymentStatus
  method: "card" | "wallet" | "bank_transfer"
  cardBrand: "visa" | "mastercard" | "amex" | null
  last4: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  description: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: Currency
  reason: "requested_by_customer" | "duplicate" | "fraudulent"
  createdAt: string
}

export interface Dispute {
  id: string
  paymentId: string
  merchantId: string
  amount: number
  currency: Currency
  reasonCode: string
  status: DisputeStatus
  openedAt: string
  /** Evidence deadline, UTC. */
  evidenceDueAt: string
}

export interface Payout {
  id: string
  merchantId: string
  periodStart: string
  periodEnd: string
  gross: number
  fees: number
  net: number
  currency: Currency
  status: PayoutStatus
  paymentIds: string[]
}

export interface PaymentFilters {
  status?: PaymentStatus | "all"
  merchantId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "amount"
  direction?: "asc" | "desc"
}

/** One entry in a card's audit trail. Append-only. */
export interface CardEvent {
  /** ISO 8601, always UTC. */
  at: string
  /** Null for the issuing event, which has no prior status. */
  from: CardStatus | null
  to: CardStatus
  note: string
}

/**
 * An issued virtual card.
 *
 * There is deliberately no field for the full number. It exists in the
 * creation response and nowhere else, so there is nothing here to leak.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** The only part of the number that is ever stored. */
  last4: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units. Authorized spend against this card so far. */
  spent: number
  currency: Currency
  status: CardStatus
  category: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  events: CardEvent[]
}
