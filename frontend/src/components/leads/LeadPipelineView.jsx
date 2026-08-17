import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical, ArrowRightCircle, GripVertical, Phone, MessageCircle,
} from "lucide-react";
import { LEAD_STATUSES, LEAD_PRIORITIES, formatDate, formatINR, isOverdue, isToday } from "@/utils/format";
import { cn } from "@/lib/utils";

export default function LeadPipelineView({ leads, onOpen, onStatusChange, onConvert }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const onDragStart = (e, lead) => {
    if (lead.is_locked) { e.preventDefault(); return; }
    setDraggingId(lead.id);
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => { setDraggingId(null); setOverCol(null); };
  const onDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overCol !== key) setOverCol(key);
  };
  const onDrop = (e, statusKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => l.id === id);
    setDraggingId(null); setOverCol(null);
    if (!lead || lead.status === statusKey) return;
    if (statusKey === "converted") {
      onConvert(lead);
    } else {
      onStatusChange(lead, statusKey);
    }
  };

  return (
    <div
      className="grid grid-cols-[repeat(10,minmax(150px,1fr))] gap-0 grid-divider-x border border-stone-200 bg-stone-200 overflow-x-auto"
      data-testid="leads-kanban"
    >
      {LEAD_STATUSES.map((s) => {
        const items = leads.filter((l) => l.status === s.key);
        const total = items.reduce((sum, l) => sum + (Number(l.budget) || 0), 0);
        const isOver = overCol === s.key;
        return (
          <div
            key={s.key}
            className={cn(
              "bg-stone-50 min-h-[480px] flex flex-col transition-colors",
              isOver && "bg-stone-100 ring-2 ring-orange-400 ring-inset",
            )}
            onDragOver={(e) => onDragOver(e, s.key)}
            onDragLeave={() => setOverCol((c) => (c === s.key ? null : c))}
            onDrop={(e) => onDrop(e, s.key)}
            data-testid={`pipeline-col-${s.key}`}
          >
            <div className={cn("px-2 py-2 border-b-2 flex flex-col gap-1", s.color)}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
                <div className="text-[9px] leading-tight tracking-[0.08em] uppercase font-semibold">{s.label}</div>
              </div>
              <div className="text-[9px] font-mono">
                <span className="font-semibold">{items.length}</span>
                {total > 0 && <span className="ml-1 text-stone-600">· {formatINR(total)}</span>}
              </div>
            </div>
            <div className="p-1.5 space-y-1.5 flex-1">
              {items.map((l) => (
                <PipelineCard
                  key={l.id}
                  lead={l}
                  isDragging={draggingId === l.id}
                  onDragStart={(e) => onDragStart(e, l)}
                  onDragEnd={onDragEnd}
                  onOpen={() => onOpen(l)}
                  onStatusChange={onStatusChange}
                  onConvert={onConvert}
                  currentStatus={s.key}
                />
              ))}
              {items.length === 0 && (
                <div className="text-xs text-stone-400 italic px-1 py-3 text-center">
                  Drag a lead here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({ lead: l, isDragging, onDragStart, onDragEnd, onOpen, onStatusChange, onConvert, currentStatus }) {
  const overdue = isOverdue(l.next_followup_date) && !["converted","lost"].includes(l.status);
  const today = isToday(l.next_followup_date);
  const priority = LEAD_PRIORITIES.find((p) => p.key === l.priority);
  const phoneClean = (l.phone || "").replace(/\D/g, "");
  return (
    <div
      draggable={!l.is_locked}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "bg-white border border-stone-200 p-2.5 hover:border-stone-500 transition-all group cursor-pointer relative",
        isDragging && "opacity-40 ring-2 ring-orange-400",
        l.is_locked && "opacity-70",
      )}
      data-testid={`kanban-card-${l.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {!l.is_locked && <GripVertical className="w-3.5 h-3.5 text-stone-300 mt-0.5 group-hover:text-stone-500 shrink-0" />}
          <div className="font-medium text-sm text-stone-900 leading-tight truncate">{l.name}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="rounded-none h-6 w-6 -mr-1 -mt-1 shrink-0"><MoreVertical className="w-3 h-3" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-none border-stone-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-2 py-1 label-uppercase">Move To</div>
            {LEAD_STATUSES.filter(x => x.key !== currentStatus && x.key !== "converted").map((x) => (
              <DropdownMenuItem key={x.key} className="rounded-none cursor-pointer" onClick={() => onStatusChange(l, x.key)}>{x.label}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-none cursor-pointer text-emerald-700" onClick={() => onConvert(l)} disabled={l.is_locked}>
              <ArrowRightCircle className="w-4 h-4 mr-2" />Convert
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="text-xs text-stone-500 mt-1 ml-5">{l.phone}</div>
      {(l.project_type || l.area) && (
        <div className="text-xs text-stone-700 mt-1.5 ml-5 truncate">
          {[l.project_type, l.area].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-2 ml-5">
        {l.budget ? <div className="text-xs font-mono text-stone-900">{formatINR(l.budget)}</div> : <span />}
        {priority && (
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] tracking-[0.1em] uppercase font-semibold border", priority.color)}>
            <span className={cn("w-1 h-1 rounded-full", priority.dot)} /> {priority.label}
          </span>
        )}
      </div>
      {l.next_followup_date && (
        <div className={cn(
          "text-[10px] tracking-widest uppercase mt-2 ml-5 font-semibold",
          overdue ? "text-rose-600" : today ? "text-orange-600" : "text-stone-500",
        )}>
          {overdue ? "Overdue · " : today ? "Today · " : "Due "}{formatDate(l.next_followup_date)}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 ml-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <a href={`tel:${phoneClean}`} className="p-1 hover:bg-stone-100 text-stone-500 hover:text-stone-900"><Phone className="w-3 h-3" /></a>
        <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="p-1 hover:bg-emerald-50 text-stone-500 hover:text-emerald-700"><MessageCircle className="w-3 h-3" /></a>
      </div>
    </div>
  );
}
