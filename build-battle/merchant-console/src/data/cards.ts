import {
  canTransition,
  generateCardNumber,
  lastFour,
  transitionError,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Card reads and the only two writes in the feature.
 *
 * Nothing here ever stores a full number. generateCardNumber produces one,
 * createCard keeps its last four, and the caller gets the number back once
 * to hand to the operator — after that it exists nowhere.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

/** The ticket's ceiling: 5,000,000 minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

const MAX_NICKNAME_LENGTH = 60

export function listCards(): Card[] {
  // Newest first: ops almost always wants the card they just issued.
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export interface IssueCardInput {
  nickname?: unknown
  merchantId?: unknown
  spendLimit?: unknown
  currency?: unknown
  category?: unknown
  idempotencyKey?: unknown
}

export interface ValidIssueCard {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory | null
  idempotencyKey: string | null
}

/** Field name to message. Empty means the input is good. */
export type ValidationErrors = Record<string, string>

/**
 * Validate an issue request. The client runs this too, for the sake of not
 * making people round-trip to find out a limit is negative — but only the
 * server's answer decides anything.
 */
export function validateIssueCard(
  input: IssueCardInput,
): { ok: true; value: ValidIssueCard } | { ok: false; errors: ValidationErrors } {
  const errors: ValidationErrors = {}

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    errors.nickname = "Give the card a nickname so ops can find it later."
  } else if (nickname.length > MAX_NICKNAME_LENGTH) {
    errors.nickname = `Keep the nickname under ${MAX_NICKNAME_LENGTH} characters.`
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : null
  if (!merchantId) {
    errors.merchantId = "Choose a merchant."
  } else if (!merchant) {
    errors.merchantId = "That merchant does not exist."
  }

  // Minor units only. A float or a "$250.00" string is client input that
  // was never converted at the boundary, and it is rejected here.
  const spendLimit = input.spendLimit
  if (typeof spendLimit !== "number" || !Number.isFinite(spendLimit)) {
    errors.spendLimit = "Enter a spend limit."
  } else if (!Number.isInteger(spendLimit)) {
    errors.spendLimit = "The spend limit must be in whole minor units."
  } else if (spendLimit <= 0) {
    errors.spendLimit = "The spend limit must be more than zero."
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.spendLimit = `The spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`
  }

  const currency = input.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    errors.currency = `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`
  }

  const category =
    input.category === null || input.category === undefined || input.category === ""
      ? null
      : (input.category as CardCategory)
  if (category !== null && !CARD_CATEGORIES.includes(category)) {
    errors.category = "That is not a category we lock cards to."
  }

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
  /**
   * The full number. Returned here and nowhere else — it is not on the
   * record and cannot be read back.
   */
  cardNumber: string
  /** True when this request had already been served under the same key. */
  replayed: boolean
}

export function createCard(input: ValidIssueCard): IssuedCard {
  if (input.idempotencyKey) {
    const existingId = issuedKeys.get(input.idempotencyKey)
    const existing = existingId ? cardById(existingId) : null
    if (existing) {
      // The card exists, so the number is gone. A replay does not get to
      // see it again — that is what reveal-once means.
      return { card: existing, cardNumber: "", replayed: true }
    }
  }

  const cardNumber = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(cardNumber),
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: now,
    events: [
      {
        at: now,
        from: null,
        to: "active",
        note: "Issued from the console",
      },
    ],
  }

  store.cards.push(card)
  if (input.idempotencyKey) issuedKeys.set(input.idempotencyKey, card.id)

  return { card, cardNumber, replayed: false }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409; message: string }

/**
 * Move a card's status. The guard lives here rather than in the route so
 * the UI and the API cannot disagree about what is legal — and so a
 * hand-made request cannot bring a cancelled card back.
 */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "No such card." }

  if (!canTransition(card.status, to)) {
    return { ok: false, status: 409, message: transitionError(card.status, to) }
  }

  card.events.push({
    at: new Date().toISOString(),
    from: card.status,
    to,
    note: `Changed from ${card.status} to ${to} in the console`,
  })
  card.status = to

  return { ok: true, card }
}
