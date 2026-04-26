import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, X, Users, ShieldCheck } from "lucide-react";
import {
  fetchProjectMembers, addProjectMember, removeProjectMember,
} from "@/services/projectService";
import { fetchProfiles } from "@/services/profileService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ProjectMembersPanel({ projectId, creatorId }) {
  const { user, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [pickUserId, setPickUserId] = useState("");
  const [pickRole, setPickRole] = useState("member");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([fetchProjectMembers(projectId), fetchProfiles().catch(() => [])]);
      setMembers(m); setProfiles(p);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const memberIds = new Set(members.map((m) => m.user_id));
  const available = profiles.filter((p) => !memberIds.has(p.id) && p.id !== creatorId);

  const handleAdd = async () => {
    if (!pickUserId) return;
    setAdding(true);
    try {
      await addProjectMember({ projectId, userId: pickUserId, role: pickRole, addedBy: user.id });
      setPickUserId(""); setPickRole("member");
      toast.success("Team member added");
      load();
    } catch (e) { toast.error(e.message); }
    finally { setAdding(false); }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(`Remove ${member.profile?.full_name || member.profile?.email} from this project?`)) return;
    try { await removeProjectMember(member.id); toast.success("Removed"); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="bg-white border border-stone-200" data-testid="project-members-panel">
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-stone-700" />
          <div className="font-display text-base tracking-tight font-semibold">Team</div>
          <span className="text-[10px] tracking-widest uppercase font-semibold text-stone-500">{members.length} member{members.length !== 1 ? "s" : ""}</span>
        </div>
        {!isAdmin && <span className="text-[10px] tracking-widest uppercase text-stone-400">Admin only</span>}
      </div>

      {/* Members list */}
      <div className="grid-divider-y">
        {loading ? (
          <div className="p-4 text-sm text-stone-500">Loading…</div>
        ) : (
          <>
            {/* Owner row */}
            <MemberRow
              displayName="Project Owner"
              caption="Created the project"
              role="owner"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              isOwner
            />
            {members.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-stone-400 italic">No additional team members yet</div>
            )}
            {members.map((m) => (
              <MemberRow
                key={m.id}
                displayName={m.profile?.full_name || m.profile?.email}
                caption={m.profile?.designation || m.profile?.email}
                role={m.role}
                onRemove={isAdmin ? () => handleRemove(m) : null}
                testId={`member-row-${m.id}`}
              />
            ))}
          </>
        )}
      </div>

      {/* Add member (admin only) */}
      {isAdmin && (
        <div className="border-t border-stone-200 p-3 bg-stone-50">
          <div className="text-[10px] tracking-widest uppercase font-semibold text-stone-500 mb-2">Assign team member</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
            <Select value={pickUserId} onValueChange={setPickUserId}>
              <SelectTrigger className="rounded-none border-stone-300 h-9 bg-white" data-testid="member-pick-user"><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {available.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-stone-500">No more users to add</div>
                ) : available.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="rounded-none">
                    {p.full_name || p.email} <span className="text-stone-500 ml-1">({p.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pickRole} onValueChange={setPickRole}>
              <SelectTrigger className="rounded-none border-stone-300 h-9 bg-white" data-testid="member-pick-role"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="lead" className="rounded-none">Lead</SelectItem>
                <SelectItem value="member" className="rounded-none">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={adding || !pickUserId} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white h-9" data-testid="member-add-btn">
              <UserPlus className="w-4 h-4 mr-1.5" />Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ displayName, caption, role, onRemove, isOwner, icon, testId }) {
  const initial = (displayName || "?").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid={testId}>
      <div className={cn(
        "w-8 h-8 rounded-full grid place-items-center font-bold text-xs",
        isOwner ? "bg-emerald-700 text-white" : role === "lead" ? "bg-orange-500 text-white" : "bg-blue-700 text-white",
      )}>{initial}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-stone-900 truncate">{displayName}</div>
        <div className="text-xs text-stone-500 truncate">{caption}</div>
      </div>
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-semibold border",
        isOwner ? "bg-emerald-50 text-emerald-800 border-emerald-300" :
        role === "lead" ? "bg-orange-50 text-orange-800 border-orange-300" :
        "bg-stone-100 text-stone-800 border-stone-300",
      )}>
        {icon} {isOwner ? "Owner" : role}
      </span>
      {onRemove && (
        <button onClick={onRemove} title="Remove" className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
