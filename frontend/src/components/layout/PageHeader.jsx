import { cn } from "@/lib/utils";

export const PageHeader = ({ title, subtitle, actions, className }) => (
  <div className={cn("border-b border-stone-200 bg-white px-6 md:px-10 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4", className)}>
    <div>
      <div className="label-uppercase">{subtitle || "Module"}</div>
      <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-1 text-stone-900">{title}</h1>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export const PageBody = ({ children, className }) => (
  <div className={cn("px-6 md:px-10 py-8", className)}>{children}</div>
);
