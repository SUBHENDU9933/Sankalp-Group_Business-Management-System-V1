import { CalendarClock, ChevronRight, Clock3, AlertTriangle, ListFilter, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "nofollowup", label: "No Follow-up", short: "No Follow-up", tone: "stone", Icon: UserRoundX },
  { key: "today", label: "Today's Follow-ups", short: "Today", tone: "orange", Icon: CalendarClock },
  { key: "next3", label: "Next 3 Days", short: "Next 3 Days", tone: "blue", Icon: Clock3 },
  { key: "next7", label: "Next 7 Days", short: "Next 7 Days", tone: "violet", Icon: Clock3 },
  { key: "overdue", label: "Overdue Follow-ups", short: "Overdue", tone: "rose", Icon: AlertTriangle },
];

export default function LeadFollowupBar({ leads = [], value = "all", onChange }) {
  const start = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const active = (l) => !["converted", "lost"].includes(l.status);
  const count = (key) => {
    const today = start();
    const next3 = addDays(today, 3);
    const next7 = addDays(today, 7);
    return leads.filter(l => {
      if (!active(l)) return false;
      if (key === "nofollowup") return !l.next_followup_date;
      if (!l.next_followup_date) return false;
      const d = new Date(l.next_followup_date);
      if (key === "today") return d.toDateString() === today.toDateString();
      if (key === "next3") return d >= today && d < next3;
      if (key === "next7") return d >= today && d < next7;
      if (key === "overdue") return d < today;
      return false;
    }).length;
  };

  const total = ITEMS.reduce((n, x) => n + count(x.key), 0);
  return (
    <div className="bg-white border border-stone-200" data-testid="lead-followup-control">
      <div className="px-4 py-2.5 border-b border-stone-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListFilter className="w-4 h-4 text-stone-500 shrink-0" />
          <div>
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Follow-up Control</div>
            <div className="text-xs text-stone-700 mt-0.5">Quickly find the leads your team needs to act on.</div>
          </div>
        </div>
        <button onClick={() => onChange?.("all")} className={cn("text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1.5 border shrink-0", value === "all" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600 hover:bg-stone-50")}>
          All Leads
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5">
        {ITEMS.map(({ key, label, short, tone, Icon }) => {
          const selected = value === key;
          const n = count(key);
          const toneClasses = {
            orange: selected ? "bg-orange-500 text-white border-orange-500" : "text-orange-700 hover:bg-orange-50",
            blue: selected ? "bg-blue-600 text-white border-blue-600" : "text-blue-700 hover:bg-blue-50",
            violet: selected ? "bg-violet-600 text-white border-violet-600" : "text-violet-700 hover:bg-violet-50",
            rose: selected ? "bg-rose-600 text-white border-rose-600" : "text-rose-700 hover:bg-rose-50",
            stone: selected ? "bg-stone-800 text-white border-stone-800" : "text-stone-700 hover:bg-stone-50",
          };
          return (
            <button key={key} onClick={() => onChange?.(key)} className={cn("min-h-[66px] px-3 sm:px-4 py-3 border-r border-b lg:border-b-0 last:border-r-0 text-left transition-colors", toneClasses[tone])} data-testid={`followup-filter-${key}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{short}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </div>
              <div className="mt-1 text-xl font-display font-bold tabular-nums">{n}</div>
            </button>
          );
        })}
      </div>
      {value !== "all" && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 text-xs text-stone-600">
          Showing <strong>{count(value)}</strong> follow-up lead{count(value) === 1 ? "" : "s"} in this queue.
        </div>
      )}
      {value === "all" && total > 0 && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 text-xs text-stone-600">
          Active follow-up queue: <strong>{total}</strong> scheduled/overdue items across these views.
        </div>
      )}
    </div>
  );
}
