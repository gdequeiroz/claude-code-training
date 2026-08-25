"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { ExportScope } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  EXPORT_COLUMN_LABELS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * The checkboxes are a convenience: the server allowlists the same column
 * names again in GET /api/payments/export. Both counts are handed down from
 * the page, which already has them from the query builder — nothing is
 * fetched from here.
 */
export function PaymentsExportDialog({
  query,
  currentCount,
  allCount,
}: {
  /** The table's active filters, already serialized. */
  query: string
  currentCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("current")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allCount : currentCount
  const nothingSelected = columns.length === 0

  const toggle = (column: ExportColumn, checked: boolean) =>
    setColumns((previous) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || previous.includes(c))
        : previous.filter((c) => c !== column),
    )

  const href = () => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what goes in the file. Card last four is left out unless you
            ask for it.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 space-y-2">
            {(
              [
                ["current", "Current filter", currentCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
              <div key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`scope-${value}`}
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                <label
                  htmlFor={`scope-${value}`}
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  {label}{" "}
                  <span className="text-gray-500 dark:text-gray-500">
                    ({count.toLocaleString()} payments)
                  </span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((column) => (
              <div key={column} className="flex items-center gap-2">
                <Checkbox
                  id={`column-${column}`}
                  checked={columns.includes(column)}
                  onCheckedChange={(checked) => toggle(column, checked === true)}
                />
                <label
                  htmlFor={`column-${column}`}
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  {EXPORT_COLUMN_LABELS[column]}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <p
          className="mt-4 text-sm text-gray-500 dark:text-gray-500"
          aria-live="polite"
        >
          {nothingSelected
            ? "Select at least one column to export."
            : `${rowCount.toLocaleString()} payments · ${columns.length} ${
                columns.length === 1 ? "column" : "columns"
              }`}
        </p>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          <Button
            className="gap-2 py-1.5"
            disabled={nothingSelected}
            asChild={!nothingSelected}
            onClick={() => setOpen(false)}
          >
            {nothingSelected ? (
              <span>Download CSV</span>
            ) : (
              <a href={href()} download>
                Download CSV
              </a>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
