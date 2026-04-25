import { cn } from "@/lib/utils";
import { LEAD_STATUSES } from "@/utils/format";

export const StatusBadge = ({ status, className }) => {
  const s = LEAD_STATUSES.find((x) => x.key === status) || LEAD_STATUSES[0];
  return (
    <span
      className={cn(
        "inline-block px-2 py-1 text-[10px] tracking-[0.15em] uppercase font-semibold border",
        s.color,
        className
      )}
      data-testid={`status-badge-${s.key}`}
    >
      {s.label}
    </span>
  );
};

export const Chip = ({ children, className, ...rest }) => (
  <span
    className={cn(
      "inline-block px-2 py-1 text-[10px] tracking-[0.15em] uppercase font-semibold border bg-stone-50 text-stone-700 border-stone-300",
      className
    )}
    {...rest}
  >
    {children}
  </span>
);
