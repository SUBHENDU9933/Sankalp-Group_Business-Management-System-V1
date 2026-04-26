import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Phone, MessageCircle, Pencil, MoreVertical, ArrowRightCircle, Trash2, X, CalendarClock,
} from "lucide-react";
import { LEAD_STATUSES, LEAD_PRIORITIES, formatDate, formatINR, isOverdue, isToday } from "@/utils/format";
import { cn } from "@/lib/utils";

function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-stone-400">—</span>;
  const p = LEAD_PRIORITIES.find((x) => x.key === priority);
  if (!p) return <span className="text-xs text-stone-400">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border", p.color)} data-testid={`priority-badge-${priority}`}>
      <span className={cn("w-1.5 h-1.5 rounded-full", p.dot)} />
      {p.label}
    </span>
  );
}

export default function LeadTableView({
  leads, onOpen, onEdit, onStatusChange, onConvert, onRequestDelete, onCancelDelete,
}) {
  return (
    <div className="bg-white border border-stone-200 overflow-x-auto">
      <table className="w-full text-sm" data-testid="leads-table">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="text-left">
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Location</Th>
            <Th>Area · Pincode</Th>
            <Th>Project</Th>
            <Th className="text-right">Budget</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>Assigned RM</Th>
            <Th>Next Follow-up</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="grid-divider-y">
          {leads.map((l) => {
            const overdue = isOverdue(l.next_followup_date) && !["converted","lost"].includes(l.status);
            const today = isToday(l.next_followup_date);
            const phoneClean = (l.phone || "").replace(/\D/g, "");
            return (
              <tr
                key={l.id}
                className={cn("hover:bg-stone-50 transition-colors cursor-pointer", l.delete_request && "bg-rose-50/40")}
                data-testid={`lead-row-${l.id}`}
                onClick={() => onOpen(l)}
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-stone-900">{l.name}</div>
                  {l.delete_request && <div className="text-[10px] tracking-widest uppercase text-rose-600 mt-1 font-semibold">Delete pending</div>}
                </td>
                <td className="px-4 py-3 align-top text-stone-700">
                  <div className="space-y-0.5">
                    <div className="text-stone-900 inline-flex items-center gap-1"><Phone className="w-3 h-3 text-stone-400" />{l.phone}</div>
                    {l.phone_secondary && <div className="text-xs text-stone-500">{l.phone_secondary}</div>}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-stone-700">{l.location || "—"}</td>
                <td className="px-4 py-3 align-top text-stone-700">
                  <div>{l.area || "—"}</div>
                  {l.pincode && <div className="text-xs text-stone-500 font-mono">{l.pincode}</div>}
                </td>
                <td className="px-4 py-3 align-top text-stone-700">
                  <div>{l.project_type || "—"}</div>
                  {l.property_type && <div className="text-xs text-stone-500">{l.property_type}</div>}
                </td>
                <td className="px-4 py-3 align-top text-stone-700 text-right tabular-nums">{formatINR(l.budget)}</td>
                <td className="px-4 py-3 align-top"><PriorityBadge priority={l.priority} /></td>
                <td className="px-4 py-3 align-top"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-3 align-top text-stone-700">{l.assigned_profile?.full_name || l.assigned_profile?.email || <span className="text-stone-400">—</span>}</td>
                <td className="px-4 py-3 align-top">
                  {l.next_followup_date ? (
                    <span className={cn("text-stone-700 inline-flex items-center gap-1", overdue && "text-rose-600 font-medium", today && "text-orange-600 font-medium")}>
                      <CalendarClock className="w-3 h-3" />
                      {formatDate(l.next_followup_date)}{overdue ? " · Overdue" : today ? " · Today" : ""}
                    </span>
                  ) : <span className="text-stone-400">—</span>}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <a href={`tel:${phoneClean}`} title="Call" className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900" data-testid={`lead-call-${l.id}`}><Phone className="w-4 h-4" /></a>
                    <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700" data-testid={`lead-whatsapp-${l.id}`}><MessageCircle className="w-4 h-4" /></a>
                    <button onClick={() => onEdit(l)} disabled={l.is_locked} title="Edit" className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed" data-testid={`lead-edit-${l.id}`}><Pencil className="w-4 h-4" /></button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-none h-8 w-8 hover:bg-stone-100" data-testid={`lead-actions-${l.id}`}><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                        <div className="px-2 py-1 label-uppercase">Set Status</div>
                        {LEAD_STATUSES.filter(s => s.key !== "converted").map((s) => (
                          <DropdownMenuItem key={s.key} className="rounded-none cursor-pointer" onClick={() => onStatusChange(l, s.key)} disabled={l.is_locked || l.status === s.key} data-testid={`lead-status-option-${s.key}-${l.id}`}>
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-none cursor-pointer text-emerald-700" onClick={() => onConvert(l)} disabled={l.is_locked || l.status === "converted"} data-testid={`lead-convert-${l.id}`}>
                          <ArrowRightCircle className="w-4 h-4 mr-2" />Convert to Customer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {l.delete_request ? (
                          <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => onCancelDelete(l)}>
                            <X className="w-4 h-4 mr-2" />Cancel Delete Request
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => onRequestDelete(l)} data-testid={`lead-delete-${l.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" />Request Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }) {
  return <th className={cn("px-4 py-3 label-uppercase whitespace-nowrap", className)}>{children}</th>;
}
