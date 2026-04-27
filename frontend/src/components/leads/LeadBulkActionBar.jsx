import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  X, ChevronDown, UserCog, Tag, Activity, Trash2, Download, CheckSquare,
} from "lucide-react";
import { LEAD_STATUSES, LEAD_PRIORITIES } from "@/utils/format";

export default function LeadBulkActionBar({
  selectedCount, totalCount, onClear, onSelectAll,
  isAdmin, rmOptions = [],
  onBulkStatus, onBulkPriority, onBulkAssign, onBulkDeleteRequest, onExportSelected,
}) {
  if (!selectedCount) return null;
  return (
    <div className="sticky top-2 z-30 bg-[#0c1c3e] text-white px-4 py-2.5 flex items-center gap-3 shadow-xl anim-fade-up rounded-none border border-orange-500" data-testid="lead-bulk-bar">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-orange-400" />
        <div className="font-mono text-sm tabular-nums">
          <span className="font-bold text-orange-400">{selectedCount}</span>
          <span className="text-stone-300"> / {totalCount}</span>
        </div>
        {selectedCount < totalCount && (
          <button onClick={onSelectAll} className="text-[10px] tracking-widest uppercase font-bold text-stone-300 hover:text-orange-300 underline" data-testid="bulk-select-all">
            Select all {totalCount}
          </button>
        )}
      </div>
      <div className="h-4 w-px bg-white/15" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Bulk Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-none h-8 text-white hover:bg-white/10 text-xs tracking-widest uppercase font-bold" data-testid="bulk-status-btn">
              <Activity className="w-3.5 h-3.5 mr-1.5" />Status<ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-none border-stone-300">
            {LEAD_STATUSES.filter((s) => s.key !== "converted").map((s) => (
              <DropdownMenuItem key={s.key} className="rounded-none cursor-pointer" onClick={() => onBulkStatus(s.key)} data-testid={`bulk-status-${s.key}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${s.dot}`} />{s.label}
              </DropdownMenuItem>
            ))}
            <div className="px-3 py-1.5 text-[9px] tracking-widest uppercase text-stone-400 border-t border-stone-100 mt-1">Use the Convert action to make a customer</div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk Priority */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-none h-8 text-white hover:bg-white/10 text-xs tracking-widest uppercase font-bold" data-testid="bulk-priority-btn">
              <Tag className="w-3.5 h-3.5 mr-1.5" />Priority<ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-none border-stone-300">
            {LEAD_PRIORITIES.map((p) => (
              <DropdownMenuItem key={p.key} className="rounded-none cursor-pointer" onClick={() => onBulkPriority(p.key)} data-testid={`bulk-priority-${p.key}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${p.dot}`} />{p.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => onBulkPriority(null)}>
              Clear priority
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk Assign (admin only) */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-none h-8 text-white hover:bg-white/10 text-xs tracking-widest uppercase font-bold" data-testid="bulk-assign-btn">
                <UserCog className="w-3.5 h-3.5 mr-1.5" />Assign<ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-none border-stone-300 max-h-[300px] overflow-y-auto">
              {rmOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-stone-500">No RMs available</div>
              ) : rmOptions.map((p) => (
                <DropdownMenuItem key={p.id} className="rounded-none cursor-pointer" onClick={() => onBulkAssign(p.id)} data-testid={`bulk-assign-${p.id}`}>
                  {p.full_name || p.email} <span className="text-stone-500 ml-1">({p.role})</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-none cursor-pointer text-stone-500" onClick={() => onBulkAssign(null)}>
                Unassign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="ghost" size="sm" className="rounded-none h-8 text-white hover:bg-white/10 text-xs tracking-widest uppercase font-bold" onClick={onExportSelected} data-testid="bulk-export-btn">
          <Download className="w-3.5 h-3.5 mr-1.5" />Export
        </Button>

        <Button variant="ghost" size="sm" className="rounded-none h-8 text-rose-300 hover:bg-rose-500/20 hover:text-white text-xs tracking-widest uppercase font-bold" onClick={onBulkDeleteRequest} data-testid="bulk-delete-btn">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />Request delete
        </Button>
      </div>
      <button onClick={onClear} className="ml-auto p-1.5 hover:bg-white/10 text-stone-300 hover:text-white" data-testid="bulk-clear">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
