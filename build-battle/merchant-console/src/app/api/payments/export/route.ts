import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops chooses the columns and the scope; both arrive as query params and both
 * are allowlisted before they reach a cell or the filename. The rows come from
 * the one query builder, unpaginated — building this in the browser would
 * export whatever page the table happens to be showing.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = parseExportScope(params.get("scope"))
  const filters = parseFilters(params)

  // "All payments" means every payment, not the filtered set. Sort still
  // applies, so the file comes out in the order the table was showing.
  const scoped: PaymentFilters =
    scope === "all"
      ? { status: "all", sort: filters.sort, direction: filters.direction }
      : filters

  const rows = sortPayments(
    filterPayments(scoped),
    scoped.sort,
    scoped.direction,
  )

  const filename = exportFilename(new Date(), {
    scope,
    status: filters.status,
    hasOtherFilters: Boolean(
      filters.merchantId || filters.search || filters.from || filters.to,
    ),
  })

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
