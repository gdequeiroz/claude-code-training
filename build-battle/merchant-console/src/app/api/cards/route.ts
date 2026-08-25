import {
  createCard,
  listCards,
  validateIssueCard,
} from "@/data/cards"
import { Card } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Card list and card issuing.
 *
 * The full number exists in exactly one response body in this whole
 * application: the 201 from POST. It is never on the record, so no other
 * route can return it even by accident.
 */

/** Every card, with nothing on it that could not be shown to anyone. */
export function GET() {
  return NextResponse.json({ cards: listCards() satisfies Card[] })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Send a JSON body." },
      { status: 400 },
    )
  }

  const parsed = validateIssueCard({
    ...(body as object),
    // The header wins over the body: it is the one a retrying client resends.
    idempotencyKey:
      request.headers.get("idempotency-key") ??
      (body as { idempotencyKey?: unknown })?.idempotencyKey,
  })

  if (!parsed.ok) {
    return NextResponse.json(
      { message: "That card could not be issued.", errors: parsed.errors },
      { status: 400 },
    )
  }

  const { card, cardNumber, replayed } = createCard(parsed.value)

  if (replayed) {
    // Same key, same card. The number is not re-revealed.
    return NextResponse.json(
      {
        card,
        replayed: true,
        message: "This card was already issued. Its number cannot be shown again.",
      },
      { status: 200 },
    )
  }

  return NextResponse.json({ card, cardNumber, replayed: false }, { status: 201 })
}
