import clsx from "clsx";
import type { ReactNode } from "react";

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  return <span className={clsx("badge", `badge-${tone}`)}>{children}</span>;
}
