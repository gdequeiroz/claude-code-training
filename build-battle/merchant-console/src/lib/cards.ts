import { CardStatus } from "@/data/types"

/**
 * Virtual card primitives: number generation, masking, and the status
 * state machine. Pure — nothing here reads or writes the store, so it can
 * be tested without booting the app.
 *
 * Nothing in this repository may resemble a real PAN. Every number this
 * module produces starts with the 4242 test BIN.
 */

/** The test BIN. Not configurable — a real BIN must never appear here. */
export const CARD_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The Luhn check digit for a partial number, i.e. the digit that makes the
 * whole string pass isLuhnValid. Doubling starts from the right of the
 * finished number, so with the check digit still missing the rightmost
 * digit of `partial` is the one that doubles.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true

  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = partial.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return (10 - (sum % 10)) % 10
}

/** Whether a complete number passes the Luhn checksum. */
export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false

  let sum = 0
  let double = false

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = cardNumber.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return sum % 10 === 0
}

/**
 * A 16-digit virtual card number on the test BIN with a valid check digit.
 *
 * Server-side only. `random` is injectable so tests can pin a number; it
 * defaults to Math.random because these are not secrets and never touch a
 * card network — they exist so the console has something to mask.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const middleLength = CARD_NUMBER_LENGTH - CARD_BIN.length - 1
  let partial = CARD_BIN
  for (let i = 0; i < middleLength; i++) {
    partial += Math.floor(random() * 10)
  }
  return partial + luhnCheckDigit(partial)
}

/** The last four of a number. The only part of it that is ever stored. */
export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number reads everywhere except the one-time reveal. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. Guarded here so the API and the UI cannot
 * disagree about what is legal.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const

export function isCardStatus(value: unknown): value is CardStatus {
  return (CARD_STATUSES as readonly unknown[]).includes(value)
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Why a transition was refused, in words safe to show an operator. */
export function transitionError(from: CardStatus, to: CardStatus): string {
  if (from === to) return `This card is already ${from}.`
  if (from === "cancelled") return "A cancelled card cannot be changed."
  return `A ${from} card cannot become ${to}.`
}
