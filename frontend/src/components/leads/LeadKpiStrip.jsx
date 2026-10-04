import { useMemo } from "react";
import {
  Users, CalendarClock, Clock3, AlertTriangle, CheckCircle2, UserRoundX,
} from "lucide-react";
import { cn } from "@/lib/utils";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isActive(l) {
  return !["converted", "lost"].includes(l.status);
}

export default function LeadKpiStrip({ leads = [], selectedFilter = "all", onFilterChange }) {
  const stats = useMemo(() => {
    const today = startOfDay();
    const next3 = addDays(today, 3);
    const next7 = addDays(today, 7);
    const active = leads.filter(isActive);
    const todayCount = active.filter(l => l.next_followup_date && new Date(l.next_followup_date).toDateString() === today.toDateString()).length;
    const next3Count = active.filter(l => l.next_followup_date && new Date(l.next_followup_date) >= today && new Date(l.next_followup_date) < next3).length;
    const next7Count = active.filter(l => l.next_followup_date && new Date(l.next_followup_date) >= today && new Date(l.next_followup_date) < next7).length;
    const overdue = active.filter(l => l.next_followup_date && new Date(l.next_followup_date) < today).length;
    const noFollowup = active.filter(l => !l.next_followup_date).length;
    const convertedThisMonth = leads.filter(l => {
      if (l.status !== "converted" || !l.updated_at) return false;
      const d = new Date(l.updated_at);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    }).length;
    return { active: active.length, todayCount, next3Count, next7Count, overdue, noFollowup, convertedThisMonth };
  }, [leads]);

  const cards = [
    { key: "active", label: "Active Leads", value: stats.active, icon: Users, tone: "blue", note: "All active & ongoing" },
    { key: "today", label: "Today's Follow-ups", value: stats.todayCount, icon: CalendarClock, tone: "orange", note: "Action required today" },
    { key: "next3", label: "Next 3 Days", value: stats.next3Count, icon: Clock3, tone: "blue", note: "Follow-ups due soon" },
    { key: "next7", label: "Next 7 Days", value: stats.next7Count, icon: Clock3, tone: "violet", note: "Stay in touch" },
    { key: "overdue", label: "Overdue Follow-ups", value: stats.overdue, icon: AlertTriangle, tone: "rose", note: "Immediate attention" },
    { key: "nofollowup", label: "No Follow-up", value: stats.noFollowup, icon: UserRoundX, tone: "stone", note: "Set next action" },
    { key: "converted", label: "Converted This Month", value: stats.convertedThisMonth, icon: CheckCircle2, tone: "emerald", note: "Closed successfully" },
  ];

  const filterActions = {
    active: "all",
    today: "today",
    next3: "next3",
    next7: "next7",
    overdue: "overdue",
    nofollowup: "nofollowup",
    converted: "converted",
  };

  const tones = {
    blue: "text-blue-700 bg-blue-50 border-blue-100",
    orange: "text-orange-700 bg-orange-50 border-orange-100",
    violet: "text-violet-700 bg-violet-50 border-violet-100",
    rose: "text-rose-700 bg-rose-50 border-rose-100",
    stone: "text-stone-700 bg-stone-50 border-stone-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
  };

  return (
    <div className="space-y-3" data-testid="leads-kpi-strip">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-stone-500">Lead Operations</div>
          <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">Active Leads</div>
          <div className="text-xs text-stone-500 mt-0.5">Your live pipeline and follow-up workload at a glance.</div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase text-stone-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live data
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map(({ key, label, value, icon: Icon, tone, note }) => {
          const selected = selectedFilter === filterActions[key];
          return (
          <button
            type="button"
            key={key}
            onClick={() => onFilterChange?.(filterActions[key])}
            className={cn(
              "bg-white border px-3.5 py-3.5 min-h-[104px] transition-all text-left w-full hover:border-stone-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-stone-300",
              selected && "ring-2 ring-stone-900 border-stone-900",
              key === "overdue" && value > 0 && !selected && "ring-1 ring-rose-100"
            )}
            data-testid={`kpi-${key}`}
            aria-pressed={selected}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={cn("w-8 h-8 flex items-center justify-center border", tones[tone])}><Icon className="w-4 h-4" /></div>
              <div className={cn("font-display text-2xl font-bold tabular-nums", tones[tone].split(" ")[0])}>{value}</div>
            </div>
            <div className="mt-2 text-[10px] tracking-[0.11em] uppercase font-bold text-stone-600 leading-tight">{label}</div>
            <div className="text-[10px] text-stone-400 mt-1 truncate">{note}</div>
            {selected && <div className="mt-1 text-[9px] tracking-wider uppercase font-semibold text-stone-500">Selected view</div>}
          </button>
          );
        })}
      </div>
    </div>
  );
}
