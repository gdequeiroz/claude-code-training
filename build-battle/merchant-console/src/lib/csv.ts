import { merchantById } from "@/data/merchants"
import { ExportScope, Payment, PaymentStatus } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns and the scope in the dialog on /payments. Everything
 * they pick arrives as a query string, so the allowlist below is the gate:
 * a column name that is not in EXPORT_COLUMNS never reaches a cell, and a
 * scope that is not an ExportScope never reaches a filename.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** Human labels for the column picker. Keyed so a new column cannot be forgotten. */
export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * The columns checked when the dialog opens, and what a request with no
 * `columns` param gets. Card last four is deliberately absent: most exports
 * go to a merchant, and it was being stripped by hand every time.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Allowlist a client-supplied `columns` value.
 *
 * Unknown names are dropped rather than rejected, duplicates collapse, and the
 * order the client asked for is preserved so ops can shape the file. Returns
 * null when the client asked for columns and none survived — that is a 400,
 * not an empty file. A missing param is not a selection, so it gets the default.
 */
export function parseExportColumns(
  raw: string | null,
): readonly ExportColumn[] | null {
  if (raw === null) return DEFAULT_EXPORT_COLUMNS

  const seen = new Set<ExportColumn>()
  const columns: ExportColumn[] = []
  for (const name of raw.split(",")) {
    const trimmed = name.trim()
    if (!isExportColumn(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    columns.push(trimmed)
  }

  return columns.length > 0 ? columns : null
}

/** Allowlist a client-supplied `scope`. Anything unrecognised means the safer one. */
export function parseExportScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "current"
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * What the export covers, in the terms the filename needs. Every field is
 * already allowlisted by the time it gets here — nothing client-authored
 * reaches the content-disposition header.
 */
export interface ExportScopeDescriptor {
  scope: ExportScope
  status?: PaymentStatus | "all"
  /** A merchant, search, or date filter is narrowing the current scope. */
  hasOtherFilters?: boolean
}

/**
 * The segment between "payments" and the date. Ops reconciles by filename, so
 * it says what the file covers: the status when one is set, "filtered" when
 * something else is narrowing it, "all" for the everything scope.
 */
function scopeSegment(descriptor: ExportScopeDescriptor): string {
  if (descriptor.scope === "all") return "all"
  if (descriptor.status && descriptor.status !== "all") return descriptor.status
  if (descriptor.hasOtherFilters) return "filtered"
  return "current"
}

/**
 * The download filename, stamped with the UTC day so it agrees with the rows
 * inside it. Called without a descriptor it keeps the original bare form.
 */
export function exportFilename(
  date = new Date(),
  descriptor?: ExportScopeDescriptor,
): string {
  const day = date.toISOString().slice(0, 10)
  if (!descriptor) return `payments-${day}.csv`
  return `payments-${scopeSegment(descriptor)}-${day}.csv`
}
