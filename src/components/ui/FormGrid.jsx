import { cn } from "@/lib/utils/cn";

export function FormGrid({ cols = 2, className, children }) {
  const colCls = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[cols];
  return (
    <div className={cn("grid gap-3", colCls, className)}>{children}</div>
  );
}