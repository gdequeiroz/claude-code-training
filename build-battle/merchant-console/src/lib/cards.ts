import { CardStatus } from "@/data/types"

/**
 * Card number generation, masking, and the status state machine. Pure, so it
 * tests without booting the app. Every number produced starts with the 4242
 * test BIN — nothing here may resemble a real PAN.
 */

/** The test BIN. Not configurable — a real BIN must never appear here. */
export const CARD_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * The digit that makes `partial` pass isLuhnValid. Doubling runs from the
 * right of the finished number, so with the check digit still missing the
 * rightmost digit of `partial` is the one that doubles.
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
 * A 16-digit number on the test BIN with a valid check digit. Server-side
 * only. `random` is injectable so tests can pin one; these never touch a card
 * network and exist so the console has something to mask.
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

/** active ⇄ frozen, either to cancelled, cancelled terminal. One source of truth. */
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
