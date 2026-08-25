import {
  createCard,
  listCards,
  validateIssueCard,
} from "@/data/cards"
import { Card } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Card list and issuing. The full number exists in exactly one response body
 * in this application — the 201 below. It is never on the record, so no other
 * route can return it even by accident.
 */

export function GET() {
  return NextResponse.json({ cards: listCards() satisfies Card[] })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const parsed = validateIssueCard({
    ...body,
    // The header wins: it is the one a retrying client resends.
    idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey,
  })
  if (!parsed.ok)
    return NextResponse.json(
      { message: "That card could not be issued.", errors: parsed.errors },
      { status: 400 },
    )

  const { card, cardNumber, replayed } = createCard(parsed.value)

  // Same key, same card — and the number is not re-revealed.
  if (replayed)
    return NextResponse.json({
      card,
      replayed: true,
      message: "This card was already issued. Its number cannot be shown again.",
    })

  return NextResponse.json({ card, cardNumber, replayed: false }, { status: 201 })
}
