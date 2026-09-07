import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chip } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProfiles, updateProfileRole, adminSetUserPassword } from "@/services/profileService";
import { assignReToRm, fetchRmReAssignments, removeReFromRm } from "@/services/rmReService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KeyRound, Eye, EyeOff } from "lucide-react";

export default function TeamPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedRm, setSelectedRm] = useState("");
  const [selectedRe, setSelectedRe] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [members, links] = await Promise.all([fetchProfiles(), fetchRmReAssignments()]);
      setProfiles(members);
      setAssignments(links);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rms = useMemo(() => profiles.filter((p) => ["rm", "manager"].includes(String(p.role).toLowerCase())), [profiles]);
  const res = useMemo(() => profiles.filter((p) => ["re", "executive"].includes(String(p.role).toLowerCase())), [profiles]);

  const handleRoleChange = async (id, role) => {
    try { await updateProfileRole(id, role); toast.success("Role updated"); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleAssign = async () => {
    if (!selectedRm || !selectedRe) return toast.error("Select both an RM and an RE");
    setSaving(true);
    try {
      await assignReToRm(selectedRm, selectedRe);
      toast.success("RE assigned to RM");
      setSelectedRe("");
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleRemove = async (id) => {
    try { await removeReFromRm(id); toast.success("RM–RE assignment removed"); await load(); }
    catch (e) { toast.error(e.message); }
  };

  const openPasswordDialog = (profile) => {
    setPasswordUser(profile);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const handleAdminPasswordChange = async () => {
    if (!passwordUser) return;
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("New password and confirmation do not match");
    setChangingPassword(true);
    try {
      await adminSetUserPassword(passwordUser.id, newPassword);
      toast.success(`Password changed for ${passwordUser.full_name || passwordUser.email}`);
      setPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) { toast.error(e.message); }
    finally { setChangingPassword(false); }
  };

  const roleLabel = { admin: "Admin", rm: "RM", re: "RE", manager: "RM", executive: "RE" };

  return (
    <div data-testid="team-page">
      <PageHeader subtitle="Admin" title="Team Members" />
      <PageBody>
        <div className="bg-white border border-stone-200 px-4 py-3"><Chip>Members: {profiles.length}</Chip></div>

        <div className="mt-6 bg-white border border-stone-200 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-stone-900">RM → RE Assignments</h2>
              <p className="text-xs text-stone-500 mt-1">Assign one RE to one or multiple RMs. This relationship also expands the RM's permitted business scope.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedRm} onValueChange={setSelectedRm}>
                <SelectTrigger className="rounded-none w-[210px] h-9"><SelectValue placeholder="Select RM" /></SelectTrigger>
                <SelectContent className="rounded-none">{rms.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedRe} onValueChange={setSelectedRe}>
                <SelectTrigger className="rounded-none w-[210px] h-9"><SelectValue placeholder="Select RE" /></SelectTrigger>
                <SelectContent className="rounded-none">{res.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={handleAssign} disabled={saving || !selectedRm || !selectedRe} className="rounded-none h-9">{saving ? "Assigning…" : "Assign RE"}</Button>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200"><tr className="text-left"><th className="px-4 py-3 label-uppercase">RM</th><th className="px-4 py-3 label-uppercase">Executive</th><th className="px-4 py-3 label-uppercase">Assigned</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="grid-divider-y">
                {assignments.length ? assignments.map((a) => <tr key={a.id}><td className="px-4 py-3 font-medium">{a.rm?.full_name || a.rm?.email || a.rm_id}</td><td className="px-4 py-3">{a.re?.full_name || a.re?.email || a.re_id}</td><td className="px-4 py-3 text-stone-500">{formatDate(a.created_at)}</td><td className="px-4 py-3 text-right"><Button variant="outline" className="rounded-none h-8" onClick={() => handleRemove(a.id)}>Remove</Button></td></tr>) : <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-stone-500">No RM–RE assignments yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          {loading ? <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div> : <div className="bg-white border border-stone-200 overflow-x-auto">
            <table className="w-full text-sm" data-testid="team-table"><thead className="bg-stone-50 border-b border-stone-200"><tr className="text-left"><th className="px-4 py-3 label-uppercase">Name</th><th className="px-4 py-3 label-uppercase">Email</th><th className="px-4 py-3 label-uppercase">Role</th><th className="px-4 py-3 label-uppercase">Joined</th><th className="px-4 py-3 label-uppercase">Security</th></tr></thead>
              <tbody className="grid-divider-y">{profiles.map((p) => <tr key={p.id} className="hover:bg-stone-50" data-testid={`team-row-${p.id}`}><td className="px-4 py-3 font-medium">{p.full_name || "—"}{p.id === user?.id && <span className="ml-2 text-xs text-orange-600">(You)</span>}</td><td className="px-4 py-3 text-stone-700">{p.email}</td><td className="px-4 py-3"><Select value={p.role} onValueChange={(v) => handleRoleChange(p.id, v)} disabled={p.id === user?.id}><SelectTrigger className={cn("rounded-none w-[120px] border-stone-300 h-8", p.role === "admin" && "bg-orange-50 border-orange-300")} data-testid={`team-role-${p.id}`}><SelectValue>{roleLabel[p.role] || p.role}</SelectValue></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="admin" className="rounded-none">Admin</SelectItem><SelectItem value="rm" className="rounded-none">Relationship Manager (RM)</SelectItem><SelectItem value="re" className="rounded-none">Relationship Executive (RE)</SelectItem></SelectContent></Select></td><td className="px-4 py-3 text-stone-600">{formatDate(p.created_at)}</td><td className="px-4 py-3"><Button variant="outline" className="rounded-none h-8" onClick={() => openPasswordDialog(p)} data-testid={`team-password-${p.id}`}><KeyRound className="w-3.5 h-3.5 mr-1.5" />Change Password</Button></td></tr>)}</tbody>
            </table></div>}
          <div className="mt-4 text-xs text-stone-500">Roles: Admin has company-wide control. RM manages permitted team/business scope. RE works within assigned/co-assigned business scope. RM–RE relationships are managed above and enforced in business scope checks.</div>
        </div>
      </PageBody>

      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && !changingPassword && setPasswordUser(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            <DialogDescription>
              Set a new sign-in password for <strong>{passwordUser?.full_name || passwordUser?.email}</strong>. This action is available to administrators only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative"><Label className="label-uppercase">New Password</Label><Input type={showPassword ? "text" : "password"} className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" data-testid="admin-new-password" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 bottom-2.5 text-stone-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            <div><Label className="label-uppercase">Confirm New Password</Label><Input type={showPassword ? "text" : "password"} className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" data-testid="admin-confirm-password" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setPasswordUser(null)} disabled={changingPassword}>Cancel</Button>
            <Button className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" onClick={handleAdminPasswordChange} disabled={changingPassword}>{changingPassword ? "Changing…" : "Change Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";
