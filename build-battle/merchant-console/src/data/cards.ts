import { canTransition, generateCardNumber, lastFour, transitionError } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Card reads and the only two writes in the feature. Nothing here stores a
 * full number: createCard keeps the last four and returns the number once.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]
/** The ticket's ceiling, in minor units. */
export const MAX_SPEND_LIMIT = 5_000_000
const MAX_NICKNAME = 60

/** Newest first: ops usually wants the card they just issued. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface ValidIssueCard {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory | null
  idempotencyKey: string | null
}

type Validated =
  | { ok: true; value: ValidIssueCard }
  | { ok: false; errors: Record<string, string> }

/**
 * Validate an issue request. The dialog runs this shape of check too, to save
 * a round trip — but only this answer decides anything.
 */
export function validateIssueCard(input: Record<string, unknown>): Validated {
  const errors: Record<string, string> = {}

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) errors.nickname = "Give the card a nickname so ops can find it later."
  else if (nickname.length > MAX_NICKNAME)
    errors.nickname = `Keep the nickname under ${MAX_NICKNAME} characters.`

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : null
  if (!merchantId) errors.merchantId = "Choose a merchant."
  else if (!merchant) errors.merchantId = "That merchant does not exist."

  // Minor units only. A float or a "$250.00" string is client input that was
  // never converted at the boundary, and it is rejected rather than coerced.
  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isFinite(spendLimit))
    errors.spendLimit = "Enter a spend limit."
  else if (!Number.isInteger(spendLimit))
    errors.spendLimit = "The spend limit must be in whole minor units."
  else if (spendLimit <= 0) errors.spendLimit = "The spend limit must be more than zero."
  else if (spendLimit > MAX_SPEND_LIMIT)
    errors.spendLimit = `The spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`

  const currency = input.currency
  if (!CARD_CURRENCIES.includes(currency as Currency))
    errors.currency = `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`
  else if (merchant && currency !== merchant.currency)
    // A card settles in its merchant's currency. The form defaults to it; this
    // is the half that enforces it.
    errors.currency = `${merchant.name} settles in ${merchant.currency}, so the card must be ${merchant.currency}.`

  const raw = input.category
  const category =
    raw === null || raw === undefined || raw === "" ? null : (raw as CardCategory)
  if (category !== null && !CARD_CATEGORIES.includes(category))
    errors.category = "That is not a category we lock cards to."

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
      category,
      idempotencyKey:
        typeof input.idempotencyKey === "string" && input.idempotencyKey
          ? input.idempotencyKey
          : null,
    },
  }
}

/** Which issue request produced which card, so a double-click cannot double-issue. */
const issuedKeys = new Map<string, string>()

export interface IssuedCard {
  card: Card
  /** The full number. Returned here and nowhere else. */
  cardNumber: string
  replayed: boolean
}

export function createCard(input: ValidIssueCard): IssuedCard {
  if (input.idempotencyKey) {
    const existing = cardById(issuedKeys.get(input.idempotencyKey) ?? "")
    // The card exists, so the number is gone. A replay does not see it again.
    if (existing) return { card: existing, cardNumber: "", replayed: true }
  }

  const cardNumber = generateCardNumber()
  const now = new Date().toISOString()
  // From the highest id in use, not the array length: length would hand out a
  // duplicate the first time a card is ever removed.
  const nextId =
    store.cards.reduce((n, c) => Math.max(n, Number(c.id.slice(5)) || 0), 0) + 1

  const card: Card = {
    id: `card_${String(nextId).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(cardNumber),
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: now,
    events: [{ at: now, from: null, to: "active", note: "Issued from the console" }],
  }

  store.cards.push(card)
  if (input.idempotencyKey) issuedKeys.set(input.idempotencyKey, card.id)
  return { card, cardNumber, replayed: false }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409; message: string }

/**
 * Move a card's status. The guard lives here, not in the route, so a
 * hand-made request cannot bring a cancelled card back.
 */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "No such card." }
  if (!canTransition(card.status, to))
    return { ok: false, status: 409, message: transitionError(card.status, to) }

  card.events.push({
    at: new Date().toISOString(),
    from: card.status,
    to,
    note: `Changed from ${card.status} to ${to} in the console`,
  })
  card.status = to
  return { ok: true, card }
}
