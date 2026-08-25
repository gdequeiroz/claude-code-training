import { Badge } from "@/components/Badge"
import { CardStatus } from "@/data/types"
import { cx } from "@/lib/utils"

/** Card status as a pill. Its own component: a different domain from payments. */

const STYLES: Record<
  CardStatus,
  { label: string; dot: string; variant: "success" | "default" | "neutral" }
> = {
  active: { label: "Active", dot: "bg-emerald-600 dark:bg-emerald-400", variant: "success" },
  frozen: { label: "Frozen", dot: "bg-blue-500", variant: "default" },
  cancelled: { label: "Cancelled", dot: "bg-gray-500", variant: "neutral" },
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  const { label, dot, variant } = STYLES[status]
  return (
    <Badge variant={variant} className="rounded-full">
      <span className={cx("size-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      {label}
    </Badge>
  )
}
