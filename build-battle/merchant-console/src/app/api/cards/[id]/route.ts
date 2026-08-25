import { cardById, transitionCard } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** One card, masked, and its status transitions. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const status = (body as { status?: unknown })?.status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({ card: result.card })
}
