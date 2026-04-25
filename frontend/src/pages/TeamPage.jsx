import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/shared/StatusBadge";
import { fetchProfiles, updateProfileRole } from "@/services/profileService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TeamPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setProfiles(await fetchProfiles()); } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleRoleChange = async (id, role) => {
    try {
      await updateProfileRole(id, role);
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="team-page">
      <PageHeader subtitle="Admin" title="Team Members" />
      <PageBody>
        <div className="bg-white border border-stone-200 px-4 py-3"><Chip>Members: {profiles.length}</Chip></div>
        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
          ) : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm" data-testid="team-table">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-left">
                    <th className="px-4 py-3 label-uppercase">Name</th>
                    <th className="px-4 py-3 label-uppercase">Email</th>
                    <th className="px-4 py-3 label-uppercase">Role</th>
                    <th className="px-4 py-3 label-uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody className="grid-divider-y">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50" data-testid={`team-row-${p.id}`}>
                      <td className="px-4 py-3 font-medium">{p.full_name || "—"}{p.id === user?.id && <span className="ml-2 text-xs text-orange-600">(You)</span>}</td>
                      <td className="px-4 py-3 text-stone-700">{p.email}</td>
                      <td className="px-4 py-3">
                        <Select value={p.role} onValueChange={(v) => handleRoleChange(p.id, v)} disabled={p.id === user?.id}>
                          <SelectTrigger className={cn("rounded-none w-[120px] border-stone-300 h-8", p.role === "admin" && "bg-orange-50 border-orange-300")} data-testid={`team-role-${p.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-none">
                            <SelectItem value="admin" className="rounded-none">Admin</SelectItem>
                            <SelectItem value="rm" className="rounded-none">RM</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs text-stone-500">
            New users can be invited via Supabase → Authentication → Users → Add user. They will be assigned the <span className="font-mono">rm</span> role by default and can be promoted to admin from this page.
          </div>
        </div>
      </PageBody>
    </div>
  );
}
