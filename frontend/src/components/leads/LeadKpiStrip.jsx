import { useMemo } from "react";
import {
  Users, PhoneCall, MapPin, FileText, CheckCircle2, XCircle, TrendingUp, IndianRupee,
} from "lucide-react";
import { formatINR } from "@/utils/format";
import { cn } from "@/lib/utils";

const KPI_DEFS = [
  { key: "total", label: "Total Leads", icon: Users, accent: "text-stone-900", ring: "ring-stone-200" },
  { key: "contacted", label: "Contacted", icon: PhoneCall, accent: "text-blue-700", ring: "ring-blue-100" },
  { key: "site_visit", label: "Site Visits", icon: MapPin, accent: "text-indigo-700", ring: "ring-indigo-100" },
  { key: "quotation_given", label: "Estimate Given", icon: FileText, accent: "text-amber-700", ring: "ring-amber-100" },
  { key: "converted", label: "Converted", icon: CheckCircle2, accent: "text-emerald-700", ring: "ring-emerald-100" },
  { key: "lost", label: "Lost", icon: XCircle, accent: "text-rose-700", ring: "ring-rose-100" },
  { key: "conversion", label: "Conversion %", icon: TrendingUp, accent: "text-orange-700", ring: "ring-orange-100" },
  { key: "revenue", label: "Expected Revenue", icon: IndianRupee, accent: "text-stone-900", ring: "ring-stone-200" },
];

export default function LeadKpiStrip({ leads }) {
  const stats = useMemo(() => {
    const total = leads.length;
    const counts = leads.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    const converted = counts.converted || 0;
    const conversion = total ? Math.round((converted / total) * 100) : 0;
    const expected = leads
      .filter((l) => !["lost"].includes(l.status))
      .reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
    return {
      total,
      contacted: counts.contacted || 0,
      site_visit: counts.site_visit || 0,
      quotation_given: counts.quotation_given || 0,
      converted,
      lost: counts.lost || 0,
      conversion,
      revenue: expected,
    };
  }, [leads]);

  const valueFor = (k) => {
    if (k === "conversion") return `${stats.conversion}%`;
    if (k === "revenue") return formatINR(stats.revenue);
    return stats[k] ?? 0;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3" data-testid="leads-kpi-strip">
      {KPI_DEFS.map(({ key, label, icon: Icon, accent, ring }) => (
        <div
          key={key}
          className={cn(
            "bg-white border border-stone-200 px-3 py-3 flex items-start gap-2.5 hover:border-stone-300 transition-colors ring-1",
            ring,
          )}
          data-testid={`kpi-${key}`}
        >
          <div className={cn("w-8 h-8 flex items-center justify-center bg-stone-50 border border-stone-200", accent)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-500 truncate">{label}</div>
            <div className={cn("font-display text-xl leading-tight tabular-nums truncate", accent)}>{valueFor(key)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
