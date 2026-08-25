import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("column selection", () => {
  it("writes a chosen subset in the order it was requested", () => {
    const columns = parseExportColumns("currency,id,amount")
    expect(columns).toEqual(["currency", "id", "amount"])
    expect(toCsv([payment], columns!)).toBe(
      ["currency,id,amount", "USD,pay_0001,$250.00"].join("\n"),
    )
  })

  it("leaves the card last four out by default, so merchant files need no cleanup", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    const header = toCsv([payment], parseExportColumns(null)!).split("\n")[0]
    expect(header).not.toContain("last4")
    expect(header.split(",")).toHaveLength(EXPORT_COLUMNS.length - 1)
  })

  it("still exports the last four when ops asks for it", () => {
    expect(toCsv([payment], parseExportColumns("id,last4")!)).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("returns null for an empty selection rather than a file with no columns", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns(",,")).toBeNull()
    expect(parseExportColumns("   ")).toBeNull()
  })

  it("drops names that are not columns, and returns null when none survive", () => {
    expect(parseExportColumns("id,payments; DROP TABLE payments")).toEqual([
      "id",
    ])
    expect(parseExportColumns("../../etc/passwd")).toBeNull()
  })

  it("collapses duplicates so a column cannot be written twice", () => {
    expect(parseExportColumns("id,id,amount,id")).toEqual(["id", "amount"])
  })
})

describe("parseExportScope", () => {
  it("only recognises all, and falls back to the narrower scope", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("current")).toBe("current")
    expect(parseExportScope("everything")).toBe("current")
    expect(parseExportScope(null)).toBe("current")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  const date = new Date("2026-08-13T23:00:00.000Z")

  it("names the status when the table is filtered to one", () => {
    expect(
      exportFilename(date, { scope: "current", status: "disputed" }),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("says all when the scope is every payment, whatever the filters were", () => {
    expect(exportFilename(date, { scope: "all", status: "disputed" })).toBe(
      "payments-all-2026-08-13.csv",
    )
  })

  it("says filtered when something other than status is narrowing it", () => {
    expect(
      exportFilename(date, {
        scope: "current",
        status: "all",
        hasOtherFilters: true,
      }),
    ).toBe("payments-filtered-2026-08-13.csv")
  })

  it("says current when nothing is narrowing it", () => {
    expect(exportFilename(date, { scope: "current", status: "all" })).toBe(
      "payments-current-2026-08-13.csv",
    )
  })
})
