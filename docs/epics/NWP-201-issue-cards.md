# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Gabriela de Queiroz
**Status:** draft

## Problem

Marcus Bell's ops team issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Merchants use these for vendor subscriptions, ad spend, and contractor tools — single-merchant, always virtual, and they need a limit from the moment they exist.

## Current state

There is no card feature. Not a route, not a type, not a handler. This is additive work, and the risk is not breaking something — it is reimplementing what already exists.

- `src/app/` — routes are `overview`, `payments`, `disputes`, `payouts`. `merchant-console/CLAUDE.md` states plainly: "Cards is NWP-201 and does not exist yet."
- `src/data/types.ts` — `Currency`, `Payment`, `Merchant`, `Refund`, `Dispute`, `Payout`. **No `Card`.** `Payment.last4` is `string | null`, so last-four-as-string is the established shape.
- `src/data/store.ts:20-27` — the `Store` interface holds five collections; cards is a sixth. Pinned to `globalThis` so dev reloads keep writes; a restart drops them, which is NWP-203's problem, not ours.
- `src/data/generate.ts:16-18` — deterministic seed (`SEED = 20260813`) via `mulberry32`, with `pick()` and `between()` helpers. Seeded cards must use the same PRNG so everyone in the room gets identical records.
- `src/lib/money.ts:16,47` — `formatMoney` and **`parseAmountToMinorUnits` already exist**; the limit field parses through the latter. A second parser is the defect the rubric looks for.
- `src/lib/dates.ts:32` — `formatDate` for tables, `formatInZone` for merchant-local display.
- `src/components/` — `Button`, `Input`, `Select`, `Badge`, `Table`, `Divider`, and `Drawer.tsx`, itself built on `@radix-ui/react-dialog`. The issue form uses the Drawer rather than adding a primitive.
- `src/components/ui/payments/StatusBadge.tsx` — the status-pill pattern. Cards get their own rather than overloading it.
- `src/components/ui/navigation/AppSidebar.tsx:26-50` — `navigation` array driven by `siteConfig.baseLinks` (`src/app/siteConfig.ts:5-10`). Cards needs an entry in both. `CreditCard` from lucide is already imported there for Payments.
- `src/app/api/payments/route.ts` — the only route-handler shape in the repo: parse, delegate to the data layer, `NextResponse.json`. Cards routes follow it.

**Where the ticket and the code disagree:**

- The ticket says card detail shows "its spend against the limit". **Nothing in the store links a payment to a card** — `Payment` has no `cardId`. Spend cannot be derived from existing data. Decision below.
- `.claude/rules/components.md` promises a `Dialog` primitive that is not there. Building the issue flow means adding it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign." | NWP-201 · rule 1 | Limits drift by cents; comparisons against 5,000,000 go wrong |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures." | `.claude/rules/cards.md` | The repo contains something that looks like a real card |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The PAN exists in client JS and in the network tab |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A PAN is re-readable; the whole point of reveal-once is gone |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life via a hand-made request |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`. The client is not trusted." | NWP-201 · core | The wrong-limit incident that filed this ticket happens again, in code |
| "Storage and bucketing are UTC." | `merchant-console/CLAUDE.md` | `createdAt` disagrees with every other timestamp in the app |
| "No database, no ORM, no migrations." | NWP-201 · out of scope | Costs the clock and earns nothing |

## Approach

Add cards as a sixth store collection and a self-contained slice: a pure `src/lib/cards.ts` holding Luhn generation, masking, and the transition guard; a `src/data/cards.ts` holding the store reads and the two writes; four route handlers under `src/app/api/cards/`; and three UI surfaces — the `/cards` list with an issue dialog, the success screen that reveals the number once, and `/cards/[id]` detail with the spend bar. Validation lives in one exported function that both `POST /api/cards` and the dialog call, but only the server's answer is load-bearing. The full PAN is generated inside the POST handler, returned in that one response, and never written to the record: the store keeps `last4` only, so there is no field to leak later.

**On spend:** `Card.spent` is an integer-minor-units field on the record, `0` for every newly issued card, with six seeded cards carrying realistic spend so the detail view and the amber-past-80% threshold have something real to show. Considered deriving spend from payments by merchant — rejected, because that is merchant volume, not card spend, and showing it as card spend would be a lie the UI tells confidently.

**Considered and rejected:** a `cardAuthorizations` seed collection summed per card — truer to how issuing works and makes "honest spend" literal, but a second seed type the ticket did not ask for. Also rejected: storing the number encrypted so it could be re-revealed; `.claude/rules/cards.md` forbids it, and "we could decrypt it" is the property reveal-once exists to remove.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardEvent`. No `number` field — only `last4`. |
| `src/lib/cards.ts` | add | Luhn check digit, `4242` generation, `maskCard`, `canTransition`. Pure, no store access. |
| `src/lib/cards.test.ts` | add | Luhn validity and BIN on generated numbers; every legal and illegal transition. |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `createCard`, `transitionCard`. The only place the store is mutated. |
| `src/data/generate.ts` | change | Six seeded cards off the existing `mulberry32` seed, with spend. |
| `src/data/store.ts` | change | `cards` on the `Store` interface and in `createStore`. |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue (validates, reveals once). |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked), `PATCH` status transition (server-guarded). |
| `src/app/cards/page.tsx` | add | The list: nickname, merchant, masked number, limit, status, created. Written empty state. |
| `src/app/cards/issue-dialog.tsx` | add | `"use client"` — the issue form and the one-time reveal screen. |
| `src/app/cards/card-actions.tsx` | add | `"use client"` — freeze/unfreeze/cancel without a full page reload. |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, spend bar, event history. |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Mirrors `ui/payments/StatusBadge.tsx` rather than overloading it. |
| `src/app/siteConfig.ts` | change | `baseLinks.cards`. |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav entry. |

## Plan

Sequenced so each step ends somewhere checkable, and so the six core criteria are all done before any stretch goal.

1. **`src/lib/cards.ts` + its tests** — done when: `npm test` shows generated numbers starting `4242`, passing Luhn, 16 digits; `canTransition` rejects everything out of `cancelled`. Tests written first.
2. **Types, store, seed** — done when: `store.cards` has six cards, deterministic across restarts, none with a full number on the record.
3. **`POST /api/cards` with validation** — done when: curl rejects a missing merchant, `0`, `-1`, `5000001`, and `JPY` with 400s and usable messages; a good request returns 201 with the full number.
4. **`GET /api/cards` and `GET /api/cards/[id]`** — done when: neither response contains a 16-digit number anywhere, only `last4`.
5. **`PATCH /api/cards/[id]`** — done when: `active→frozen→active` works, `cancelled→active` returns 409 from the server with the UI out of the picture.
6. **`/cards` list + issue dialog + reveal screen** — done when: issuing from the browser shows the number once, closing the screen loses it, and the list row shows `•••• ####`.
7. **`/cards/[id]` detail + spend bar** — done when: a card past 80% renders amber and one under it does not.
8. **Freeze/unfreeze from the list** — done when: status flips without a full page reload.
9. **Category lock, empty state, error states** — done when: `/cards` with an emptied store reads as written, not as a blank table.
10. **`/ship-ready`, then `npm test`** — done when: both clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the dialog on `/cards`, submit, see the new card in the list |
| Card list | `/cards` shows nickname, merchant, masked number, limit, status, created date |
| Card detail | `/cards/<id>` shows the full record and spend against limit |
| Generated numbers | `cards.test.ts`: BIN is `4242`, Luhn valid, over many generated numbers |
| Reveal once, mask forever | `curl POST` shows the number; `curl GET` of the same card does not. Grep the list and detail payloads for a 16-digit run |
| Server-side validation | Five curl 400s from step 3, with the browser out of the loop |
| Freeze / unfreeze (stretch) | Click freeze in the list; row updates without a reload |
| Spend progress (stretch) | Seeded card over 80% renders amber |
| Category lock (stretch) | Chosen at issue, shown on list and detail |
| Tests (stretch) | `npm test` — Luhn and transitions covered |
| Empty and error states (stretch) | `/cards` with no cards; a rejected submit shows the server's message |

## Risks

- **A PAN leaking into a payload.** The mitigation is structural: `Card` has no field to hold one, so a leak requires someone to add a field. Step 4's grep is the check.
- **Reveal-once surviving in client state.** The success screen holds the number in React state; closing must clear it, not just hide it. Verify the dialog cannot be reopened onto a revealed number.
- **Second implementations.** `parseAmountToMinorUnits` and `formatMoney` already exist. Any new money parsing or formatting in this diff is a defect.
- **Client-only transition guards.** Disabled buttons are a convenience. The 409 in step 5 is the real check.
- **Clock.** Ten steps, six of them core. If time runs out, it runs out after step 7, and the PR says which stretch goals were not reached rather than implying they were.

## Out of scope

- Persistence of any kind. NWP-203.
- Editing a limit after issue. NWP-202.
- Auth, roles, permissions. Real card network calls.
- The lexicographic amount sort at `src/data/queries.ts:81` and the `/100` money-rule violations in `src/data/metrics.ts:31,34` and `src/data/analytics.ts:54,73`. Real, pre-existing, and not this ticket.

## Open questions

- Category lock has no list of categories anywhere in the repo. Using advertising / software / travel / contractors / utilities, and saying so in the PR rather than inventing a taxonomy silently.
- The ticket credits "work the ticket did not spell out". Reading that as: an audit trail on the card record, idempotent issuing so a double-click cannot make two cards, and currency defaulting to the merchant's own — all three are things this codebase already knows (`Merchant.currency` exists) and an ops tool needs the second real people use it.
