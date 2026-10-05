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
    const totalConverted = leads.filter(l => l.status === "converted").length;
    return { active: active.length, todayCount, next3Count, next7Count, overdue, noFollowup, totalConverted };
  }, [leads]);

  const cards = [
    { key: "active", label: "Active Leads", value: stats.active, icon: Users, tone: "blue", note: "All active & ongoing" },
    { key: "today", label: "Today's Follow-ups", value: stats.todayCount, icon: CalendarClock, tone: "orange", note: "Action required today" },
    { key: "next3", label: "Next 3 Days", value: stats.next3Count, icon: Clock3, tone: "blue", note: "Follow-ups due soon" },
    { key: "next7", label: "Next 7 Days", value: stats.next7Count, icon: Clock3, tone: "violet", note: "Stay in touch" },
    { key: "overdue", label: "Overdue Follow-ups", value: stats.overdue, icon: AlertTriangle, tone: "rose", note: "Immediate attention" },
    { key: "nofollowup", label: "No Follow-up", value: stats.noFollowup, icon: UserRoundX, tone: "stone", note: "Set next action" },
    { key: "converted", label: "Converted Leads", value: stats.totalConverted, icon: CheckCircle2, tone: "emerald", note: "Total converted successfully" },
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
    blue: { card: "from-blue-50 via-white to-blue-50/60 border-blue-100 hover:from-blue-100 hover:via-blue-50 hover:to-blue-100/80", icon: "bg-blue-500 text-white shadow-blue-200", accent: "text-blue-600" },
    orange: { card: "from-orange-50 via-white to-orange-50/60 border-orange-100 hover:from-orange-100 hover:via-orange-50 hover:to-orange-100/80", icon: "bg-orange-500 text-white shadow-orange-200", accent: "text-orange-600" },
    violet: { card: "from-violet-50 via-white to-violet-50/60 border-violet-100 hover:from-violet-100 hover:via-violet-50 hover:to-violet-100/80", icon: "bg-violet-500 text-white shadow-violet-200", accent: "text-violet-600" },
    rose: { card: "from-rose-50 via-white to-rose-50/60 border-rose-100 hover:from-rose-100 hover:via-rose-50 hover:to-rose-100/80", icon: "bg-rose-500 text-white shadow-rose-200", accent: "text-rose-600" },
    stone: { card: "from-stone-50 via-white to-stone-50/60 border-stone-200 hover:from-stone-100 hover:via-stone-50 hover:to-stone-100/80", icon: "bg-stone-500 text-white shadow-stone-200", accent: "text-stone-600" },
    emerald: { card: "from-emerald-50 via-white to-emerald-50/60 border-emerald-100 hover:from-emerald-100 hover:via-emerald-50 hover:to-emerald-100/80", icon: "bg-emerald-500 text-white shadow-emerald-200", accent: "text-emerald-600" },
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
              "group relative min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 min-h-[118px] shadow-sm transition-all duration-300 ease-out text-left w-full hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,.38)] hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-stone-300",
              tones[tone].card,
              selected && "ring-2 ring-stone-900 border-stone-900",
              key === "overdue" && value > 0 && !selected && "ring-1 ring-rose-100"
            )}
            data-testid={`kpi-${key}`}
            aria-pressed={selected}
          >
            <div className="pointer-events-none absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-white/50 blur-2xl transition-transform duration-500 group-hover:scale-125" />\n            <div className="relative flex items-start justify-between gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl", tones[tone].icon)}><Icon className="w-4 h-4" /></div>
              <div className="truncate font-display text-[25px] font-black leading-none tracking-[-.045em] tabular-nums text-stone-900">{value}</div>
            </div>
            <div className="relative mt-3 text-[10px] tracking-[0.11em] uppercase font-extrabold text-stone-500 leading-tight">{label}</div>
            <div className="relative mt-1 text-[10px] font-medium text-stone-500 truncate">{note}</div>\n            <div className={cn("relative mt-2 flex h-7 w-7 items-center justify-center rounded-full border bg-white/90 text-xs font-bold shadow-sm transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-white", tones[tone].accent)}>›</div>
            {selected && <div className="mt-1 text-[9px] tracking-wider uppercase font-semibold text-stone-500">Selected view</div>}
          </button>
          );
        })}
      </div>
    </div>
  );
}
