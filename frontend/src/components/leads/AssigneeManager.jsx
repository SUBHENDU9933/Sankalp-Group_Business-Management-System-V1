import { useMemo, useState } from "react";
import { addLeadAssignee, removeLeadAssignee } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { UserPlus, X, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ----------------------------------------------------------------------
// Avatar bubble — initials in coloured circle.
// ----------------------------------------------------------------------
function initials(name = "?") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";
}

const PALETTE = [
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-violet-100 text-violet-800 border-violet-300",
  "bg-amber-100 text-amber-800 border-amber-300",
];
function colorFor(id = "") {
  const sum = String(id).split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

export function AssigneeAvatar({ profile, size = "sm", showRemove = false, onRemove, title }) {
  const dim = size === "lg" ? "w-9 h-9 text-xs" : size === "md" ? "w-7 h-7 text-[10px]" : "w-6 h-6 text-[10px]";
  const name = profile?.full_name || profile?.email || "Unknown";
  return (
    <span className="relative inline-flex">
      <span
        title={title || name}
        className={cn(
          "inline-flex items-center justify-center font-semibold border-2 border-white rounded-full select-none",
          colorFor(profile?.id),
          dim
        )}
      >
        {initials(name)}
      </span>
      {showRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="absolute -top-1 -right-1 bg-stone-900 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-rose-600"
          title="Remove"
          data-testid={`assignee-remove-${profile?.id}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

export function AvatarStack({ assignees = [], primary, max = 3, size = "sm", onClick, dataTestId }) {
  const all = useMemo(() => {
    const ids = new Set();
    const out = [];
    if (primary?.id) { out.push(primary); ids.add(primary.id); }
    for (const a of assignees) {
      const p = a.profile || a;
      if (p?.id && !ids.has(p.id)) { out.push(p); ids.add(p.id); }
    }
    return out;
  }, [assignees, primary]);

  if (!all.length) return <span className="text-xs text-stone-400">—</span>;
  const visible = all.slice(0, max);
  const overflow = all.length - visible.length;
  return (
    <span className="inline-flex items-center -space-x-1.5 cursor-pointer" onClick={onClick} data-testid={dataTestId}>
      {visible.map((p) => (
        <AssigneeAvatar key={p.id} profile={p} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center font-semibold border-2 border-white rounded-full bg-stone-200 text-stone-700",
            size === "lg" ? "w-9 h-9 text-xs" : size === "md" ? "w-7 h-7 text-[10px]" : "w-6 h-6 text-[10px]"
          )}
          title={`+${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ----------------------------------------------------------------------
// AssigneeManager: popover/inline picker to add or remove RMs.
// ----------------------------------------------------------------------
export default function AssigneeManager({
  lead, profiles = [], onChanged, variant = "inline", buttonClassName = "",
}) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // All RMs currently on this lead (junction first, fallback to assigned_to alone)
  const currentList = useMemo(() => {
    const arr = [];
    const seen = new Set();
    if (lead?.assigned_profile?.id) {
      arr.push(lead.assigned_profile); seen.add(lead.assigned_profile.id);
    }
    (lead?.assignees || []).forEach((a) => {
      const p = a.profile || a;
      if (p?.id && !seen.has(p.id)) { arr.push(p); seen.add(p.id); }
    });
    return arr;
  }, [lead]);

  // Permission: admin OR creator OR currently assigned (primary or co-assignee)
  const canManage =
    isAdmin ||
    lead?.created_by === user?.id ||
    lead?.assigned_to === user?.id ||
    currentList.some((p) => p.id === user?.id);

  const candidates = useMemo(() => {
    const assignedIds = new Set(currentList.map((p) => p.id));
    return profiles.filter((p) => {
      if (assignedIds.has(p.id)) return false;
      if (!search) return true;
      const hay = `${p.full_name || ""} ${p.email || ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [profiles, currentList, search]);

  const handleAdd = async (rm) => {
    if (busy) return;
    setBusy(true);
    try {
      await addLeadAssignee(lead.id, rm.id, user.id);
      toast.success(`Added ${rm.full_name || rm.email}`);
      setSearch("");
      onChanged?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleRemove = async (rm) => {
    if (busy) return;
    if (!window.confirm(`Remove ${rm.full_name || rm.email} from this lead?`)) return;
    setBusy(true);
    try {
      await removeLeadAssignee(lead.id, rm.id);
      // If primary was removed, also clear assigned_to so leads list updates correctly
      if (lead.assigned_to === rm.id) {
        await import("@/services/leadService").then((m) => m.updateLead(lead.id, { assigned_to: null }));
      }
      toast.success(`Removed ${rm.full_name || rm.email}`);
      onChanged?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  // ----- Inline (used in detail drawer) ----------------------------------
  if (variant === "inline") {
    return (
      <div className="space-y-2" data-testid="assignee-manager-inline">
        <div className="flex items-center justify-between">
          <div className="label-uppercase">Assigned RMs ({currentList.length})</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentList.length === 0 && <span className="text-xs text-stone-400">No one assigned yet</span>}
          {currentList.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-stone-50 border border-stone-200 rounded-full"
              data-testid={`assignee-chip-${p.id}`}
            >
              <AssigneeAvatar profile={p} size="sm" />
              <span className="text-xs text-stone-700 max-w-[140px] truncate">{p.full_name || p.email}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(p)}
                  className="ml-0.5 text-stone-400 hover:text-rose-600"
                  title="Remove"
                  data-testid={`assignee-remove-inline-${p.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs"
                data-testid="assignee-add-inline-btn"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Add RM
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="rounded-none border-stone-300 w-72 p-0">
              <RMPickerList
                candidates={candidates}
                search={search}
                onSearchChange={setSearch}
                onPick={(rm) => { handleAdd(rm); }}
                busy={busy}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // ----- Quick popover (used in lead row +RM button) --------------------
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={!canManage}
          title={canManage ? "Manage RMs" : "Only admin or assigned RM can manage"}
          className={cn(
            "p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed",
            buttonClassName
          )}
          data-testid={`lead-assignees-quick-${lead?.id}`}
        >
          <Users className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="rounded-none border-stone-300 w-72 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-stone-200">
          <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">
            Current ({currentList.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentList.length === 0 && <span className="text-xs text-stone-400">No one assigned</span>}
            {currentList.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 bg-stone-50 border border-stone-200 rounded-full text-[11px]">
                <AssigneeAvatar profile={p} size="sm" />
                <span className="max-w-[100px] truncate">{p.full_name || p.email}</span>
                {canManage && (
                  <button type="button" onClick={() => handleRemove(p)} className="text-stone-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
        {canManage ? (
          <RMPickerList
            candidates={candidates}
            search={search}
            onSearchChange={setSearch}
            onPick={handleAdd}
            busy={busy}
          />
        ) : (
          <div className="p-3 text-xs text-stone-500">You don't have permission to manage RMs on this lead.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RMPickerList({ candidates, search, onSearchChange, onPick, busy }) {
  return (
    <>
      <div className="p-2 border-b border-stone-200 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-stone-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search RMs…"
          className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-7 text-xs"
          autoFocus
          data-testid="assignee-picker-search"
        />
      </div>
      <div className="max-h-56 overflow-auto">
        {candidates.length === 0 ? (
          <div className="p-3 text-xs text-stone-500">No matching RMs</div>
        ) : candidates.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(p)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-stone-50 disabled:opacity-50"
            data-testid={`assignee-pick-${p.id}`}
          >
            <AssigneeAvatar profile={p} size="md" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-stone-900 truncate">{p.full_name || "(no name)"}</span>
              <span className="block text-[11px] text-stone-500 truncate">{p.email}</span>
            </span>
            <UserPlus className="w-3.5 h-3.5 text-stone-400" />
          </button>
        ))}
      </div>
    </>
  );
}
