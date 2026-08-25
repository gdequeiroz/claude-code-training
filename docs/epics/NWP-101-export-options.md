# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Gabriela de Queiroz
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and every file comes out identical: every column, current filter only. The card last-four is in all of them, so anything going to a merchant gets hand-cleaned in a spreadsheet first. That is 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx:69` — the Export button is a plain `<a href="/api/payments/export?{query}">`. The query string is the page's own `searchParams`, so the export already inherits the active filters. No dialog, no options.
- `src/app/api/payments/export/route.ts:11-25` — the handler calls `parseFilters()`, then `filterPayments()` + `sortPayments()`, and hands the result to `toCsv(rows)` with **no** `columns` argument. `paginate()` is deliberately not called, so the export already covers the whole filtered set, not one page.
- `src/lib/csv.ts:58` — `toCsv(payments, columns = EXPORT_COLUMNS)` **already takes a column list**. The seam exists; the route just never uses it. This is the entire reason `last4` ships in every file.
- `src/lib/csv.ts:13-26` — `EXPORT_COLUMNS` and the `ExportColumn` union are exported. That tuple is the natural allowlist.
- `src/lib/csv.ts:33-56` — `cell()` already formats `amount` through `formatMoney()` and emits `currency` as its own column. Acceptance criterion 4 is **already satisfied** by the existing code; it needs preserving, not building.
- `src/lib/csv.ts:69` — `exportFilename(date)` takes only a date and returns `payments-YYYY-MM-DD.csv`. Scope has no way to reach it.
- `src/data/queries.ts:18-41` — `parseFilters()` is the allowlist chokepoint: statuses checked against `STATUSES`, sort narrowed to `amount | createdAt`, direction to `asc | desc`, page coerced to a positive number. Column names are a new kind of client input and belong here or immediately beside it.
- `src/data/queries.ts:102` — `queryPayments()` returns `{ rows, total, page, pageCount, pageSize }`. `GET /api/payments` (`src/app/api/payments/route.ts:5-8`) returns that verbatim, so **the row count ops needs before download is already available** — no new endpoint.
- `src/lib/csv.test.ts` — eight `toCsv` tests plus one `exportFilename` test. Its header comment states NWP-101 changes which columns ship, not how a cell is written, and that these should still pass afterwards.

**Where the ticket and the code disagree:**

- The ticket warns "the payments table is paginated. Building this in the browser exports the current page only." True of a browser-side rewrite, but the *existing* handler already skips `paginate()`. The risk is regressing this, not fixing it.
- `.claude/rules/components.md` says `src/components/` "already has Button, Input, Select, Dialog, Badge". There is **no `Dialog.tsx`** and no `Checkbox.tsx`. The closest thing is `Drawer.tsx`, itself built on `@radix-ui/react-dialog`.
- `sortPayments()` (`src/data/queries.ts:81`) sorts by amount with `String(a.amount).localeCompare(...)` — a lexicographic sort on minor units, so `$90.00` (9000) sorts above `$250.00` (25000). Pre-existing, visible in exported row order, **out of scope here**.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `CLAUDE.md` | Arbitrary strings reach `cell()` and the `content-disposition` header |
| "Validate everything from the client against an allowlist… Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | The dialog's checkboxes become the only gate; a hand-edited URL bypasses them |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `CLAUDE.md` | Two filter paths drift; export stops matching the table |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | `CLAUDE.md` | Cents drift; already correct in `cell()` and must stay that way |
| "Storage and bucketing are UTC." | `CLAUDE.md` | The date in the filename disagrees with the rows in the file |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Ops cannot operate the dialog by keyboard |
| "Reach for those before adding a dependency or hand-rolling a control." | `.claude/rules/components.md` | A third button style enters the codebase |

## Approach

Keep the export a server round-trip and extend the existing seams rather than opening new ones. The Export button becomes a trigger for a client dialog that holds column checkboxes (last-four unchecked by default), a scope radio, and a live row count read from `GET /api/payments` — the count endpoint already exists and returns `total`. Download stays an `<a>` to `/api/payments/export`, now carrying `columns=` and `scope=` alongside the filters already in the URL. The handler gains a `parseExportOptions()` helper beside `parseFilters()` that intersects the requested columns against `EXPORT_COLUMNS` and narrows scope to `current | all`; `scope=all` means calling `filterPayments({})` instead of skipping the builder. `exportFilename()` grows a scope/status argument, both drawn from allowlisted values so nothing client-authored reaches the header.

**Considered and rejected:** building the CSV in the browser from the rows already on the page. It removes the round-trip and the validation problem entirely — and it exports twenty rows, because `src/app/payments/page.tsx:45` renders one paginated page. That is the bug the ticket names, shipped as the feature.

**Also rejected:** a `POST /api/payments/export` taking a JSON body. Cleaner for long column lists, but it breaks the plain-`<a>` download and means fetch + blob + object URL in the client for no gain at ten columns.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `exportFilename(date, scope, status)` builds the scope segment; `EXPORT_COLUMNS` grows a companion label map for the dialog. `toCsv` and `cell()` unchanged. |
| `src/lib/csv.test.ts` | change | Extend, do not replace. New cases for the filename segments and the column serializer's allowlist behaviour. |
| `src/data/queries.ts` | change | Add `parseExportOptions(params)` beside `parseFilters` — the allowlist for `columns` and `scope`. |
| `src/app/api/payments/export/route.ts` | change | Use the parsed options: pass `columns` to `toCsv`, honour `scope`, pass scope/status to `exportFilename`. Return 400 on an empty column set. |
| `src/components/Dialog.tsx` | add | No Dialog primitive exists. Tremor-style wrapper on `@radix-ui/react-dialog` (already a dependency). |
| `src/components/Checkbox.tsx` | add | No Checkbox primitive exists. Needs `@radix-ui/react-checkbox`. |
| `src/app/payments/export-dialog.tsx` | add | `"use client"` — column checkboxes, scope radio, row count, Download link. Sits beside `filter-bar.tsx`, same pattern. |
| `src/app/payments/page.tsx` | change | Replace the `<a>` Export button with `<ExportDialog>`, passing the current filters and `total`. |
| `package.json` | change | Add `@radix-ui/react-checkbox`. |

## Plan

1. **Filename and column allowlist in `src/lib/csv.ts`** — done when: `exportFilename(new Date("2026-08-13T23:00:00Z"), "current", "disputed")` returns `payments-disputed-2026-08-13.csv`, and `"all"` scope returns `payments-all-2026-08-13.csv`. Tests written first, in the existing file.
2. **`parseExportOptions()` in `src/data/queries.ts`** — done when: unknown column names are dropped rather than passed through, `scope` falls back to `current`, and an empty result is distinguishable from "no columns requested".
3. **Wire the export route** — done when: `curl '/api/payments/export?status=disputed&columns=id,amount,currency'` returns three columns and a `payments-disputed-<today>.csv` filename; `columns=id,DROP TABLE` returns only `id`; `columns=` alone returns 400.
4. **Scope handling in the route** — done when: `scope=all&status=disputed` returns every payment, not just disputed ones, and row count matches `/api/payments?page=1`'s `total` with no filters.
5. **`Dialog.tsx` and `Checkbox.tsx`** — done when: both render in the Tremor style of the neighbouring primitives, Escape closes the dialog, and focus returns to the trigger.
6. **`export-dialog.tsx`** — done when: last-four is unchecked on open, scope defaults to current filter, the count updates when scope flips, and Download is disabled with every box cleared.
7. **Swap the button in `page.tsx`** — done when: the full flow works from `/payments?status=disputed` and the downloaded file matches what the dialog promised.
8. **`npm test`** — done when: the pre-existing `csv.test.ts` cases still pass alongside the new ones.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four **off** by default | Open the dialog on `/payments` — `last4` unchecked. Unit test: `toCsv` with a column list omitting `last4` produces no such column. |
| Scope: current filter or all payments, current is default | `curl` step 4 above. In the UI, flip scope on a filtered page and watch the count change. |
| Row count visible before download | Dialog shows the count from `GET /api/payments`; compare against the `{total} payments` line at `src/app/payments/page.tsx:142`. |
| Filename reflects scope and date | New `exportFilename` cases in `src/lib/csv.test.ts`, covering status, `filtered`, `current`, and `all`, with a 23:00Z instant to pin UTC. |
| Amounts in minor units, formatted once, currency its own column | Existing `csv.test.ts` cases for `amount` and `card_brand,last4` must still pass untouched. |
| Deselecting every column disables Download | Clear every box — the Download link is disabled. Server-side: `columns=` returns 400, not an empty file. |

## Risks

- **Regressing to a browser-side export.** The riskiest single edit is anything that moves CSV assembly into `export-dialog.tsx`. Assembly stays in `src/lib/csv.ts`, called from the route handler.
- **Client-only validation.** Easy to check the boxes and forget the server. Step 3's `columns=id,DROP TABLE` curl is the guard, and it belongs in the PR description.
- **Column order.** `toCsv` writes columns in the order given, and the dialog will hand over checkbox order. Pin the order to `EXPORT_COLUMNS` in the parser so two ops with the same selection get the same file.
- **`@radix-ui/react-checkbox` is a new dependency.** Small and from a family already in `package.json`, but it is still a dependency added in a ticket that did not ask for one. Flag it in the PR.
- **`content-disposition` injection.** Every segment of the filename must come from an allowlisted value — never from `search` or a merchant name.

## Out of scope

- The lexicographic amount sort at `src/data/queries.ts:81`. Real, visible in exported row order, and its own ticket.
- Remembering column choices between sessions. Not asked for; would need persistence, which is NWP-203.
- Scheduled or emailed exports, and any format other than CSV.
- Adding a `Dialog`/`Checkbox` entry to `.claude/rules/components.md` — worth doing once these exist, but a docs change rides badly in a feature PR.

## Open questions

- The `filtered` filename segment fires when a merchant or search filter is active with no status. If ops would rather see the merchant name there, that is client input reaching a filename and needs a slug sanitizer — say so now rather than after the fact.
- Should `scope=all` ignore the date range too, or only status/merchant/search? Reading it as "all payments, no filters at all" for now.
