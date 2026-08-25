import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  CARD_BIN,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskCard,
  transitionError,
} from "./cards"

/**
 * Card numbers and status are the two places this feature can be wrong in a
 * way nobody notices until it matters: a number that resembles a real PAN,
 * or a cancelled card that comes back to life.
 */

/** Deterministic stand-in for Math.random, so a failure reproduces. */
function sequence(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe("luhnCheckDigit", () => {
  it("produces the digit that completes a known number", () => {
    // 4242424242424242 is the canonical test card: strip its check digit
    // and the function should hand it back.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns a single digit for any partial", () => {
    for (let i = 0; i < 50; i++) {
      const partial = CARD_BIN + String(i).padStart(11, "0")
      const digit = luhnCheckDigit(partial)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isLuhnValid", () => {
  it("accepts the canonical test card", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with one digit changed", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 test BIN, so nothing resembles a real PAN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(CARD_BIN)).toBe(true)
    }
  })

  it("always produces sixteen digits with a valid check digit", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^\d{16}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is deterministic when the randomness is", () => {
    const digits = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.0, 0.15]
    expect(generateCardNumber(sequence(digits))).toBe(
      generateCardNumber(sequence(digits)),
    )
    expect(isLuhnValid(generateCardNumber(sequence(digits)))).toBe(true)
  })

  it("keeps only the last four for storage, and masks the rest", () => {
    const number = generateCardNumber()
    const last4 = lastFour(number)
    expect(last4).toHaveLength(4)
    expect(number.endsWith(last4)).toBe(true)
    expect(maskCard(last4)).toBe(`•••• ${last4}`)
    expect(maskCard(last4)).not.toContain(number.slice(0, 12))
  })
})

describe("canTransition", () => {
  it("allows a card to be frozen and thawed", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal — nothing comes back from it", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a transition to the status a card already has", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("covers every pair, so a new status cannot be added unnoticed", () => {
    const statuses: CardStatus[] = ["active", "frozen", "cancelled"]
    const allowed = statuses.flatMap((from) =>
      statuses.filter((to) => canTransition(from, to)).map((to) => `${from}->${to}`),
    )
    expect(allowed.sort()).toEqual([
      "active->cancelled",
      "active->frozen",
      "frozen->active",
      "frozen->cancelled",
    ])
  })
})

describe("transitionError", () => {
  it("says why, in words an operator can act on", () => {
    expect(transitionError("cancelled", "active")).toBe(
      "A cancelled card cannot be changed.",
    )
    expect(transitionError("active", "active")).toBe(
      "This card is already active.",
    )
  })
})
