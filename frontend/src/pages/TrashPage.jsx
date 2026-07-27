import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RotateCcw, Search, X, ShieldAlert } from "lucide-react";
import { TRASH_ENTITIES, listTrash, restoreItem, restoreMany, purgeItem, purgeMany } from "@/services/trashService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

export default function TrashPage() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(TRASH_ENTITIES[0].key);
  const [rowsByKey, setRowsByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});   // per-entity id set

  const currentEnt = TRASH_ENTITIES.find((e) => e.key === activeTab);
  const rows = rowsByKey[activeTab] || [];

  const load = async (key = activeTab) => {
    setLoading(true);
    try {
      const data = await listTrash(key);
      setRowsByKey((prev) => ({ ...prev, [key]: data }));
    } catch (e) { toast.error(`${key}: ${e.message}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(activeTab); /* eslint-disable-line */ }, [activeTab]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s));
  }, [rows, search]);

  // Non-admin: only rows they created / owned
  const visible = useMemo(() => {
    if (isAdmin) return filtered;
    return filtered.filter((r) => r.created_by === user?.id || r.deleted_by === user?.id || r.assigned_to === user?.id);
  }, [filtered, isAdmin, user]);

  const selectedIds = () => Object.keys(selected[activeTab] || {}).filter((id) => selected[activeTab][id]);
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const cur = { ...(prev[activeTab] || {}) };
      cur[id] = !cur[id];
      return { ...prev, [activeTab]: cur };
    });
  };
  const toggleAll = (checked) => {
    setSelected((prev) => {
      const cur = {};
      if (checked) visible.forEach((r) => { cur[r.id] = true; });
      return { ...prev, [activeTab]: cur };
    });
  };
  const clearSelection = () => setSelected((prev) => ({ ...prev, [activeTab]: {} }));

  const handleRestore = async (row) => {
    if (!window.confirm(`Restore "${row[currentEnt.labelField] || row.id}"?`)) return;
    try {
      await restoreItem(activeTab, row.id);
      toast.success("Restored");
      load();
    } catch (e) { toast.error(e.message); }
  };
  const handlePurge = async (row) => {
    if (!isAdmin) { toast.error("Only admin can permanently delete"); return; }
    if (!window.confirm(`PERMANENTLY delete "${row[currentEnt.labelField] || row.id}"? This CANNOT be undone.`)) return;
    try {
      await purgeItem(activeTab, row.id);
      toast.success("Permanently deleted");
      load();
    } catch (e) { toast.error(e.message); }
  };
  const handleBulkRestore = async () => {
    const ids = selectedIds();
    if (!ids.length) return;
    if (!window.confirm(`Restore ${ids.length} item(s)?`)) return;
    try {
      await restoreMany(activeTab, ids);
      toast.success(`Restored ${ids.length}`);
      clearSelection(); load();
    } catch (e) { toast.error(e.message); }
  };
  const handleBulkPurge = async () => {
    if (!isAdmin) { toast.error("Only admin"); return; }
    const ids = selectedIds();
    if (!ids.length) return;
    if (!window.confirm(`PERMANENTLY delete ${ids.length} item(s)? This CANNOT be undone.`)) return;
    try {
      await purgeMany(activeTab, ids);
      toast.success(`Purged ${ids.length}`);
      clearSelection(); load();
    } catch (e) { toast.error(e.message); }
  };

  const sel = selected[activeTab] || {};
  const selCount = Object.values(sel).filter(Boolean).length;

  return (
    <div data-testid="trash-page">
      <PageHeader
        title="Trash / Recycle Bin"
        subtitle={isAdmin ? "Admin view — all deleted records across the system" : "Your deleted records — restore within 30 days"}
      />
      <PageBody>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); clearSelection(); }}>
          <TabsList className="rounded-none border border-stone-200 bg-white p-0 h-auto flex flex-wrap">
            {TRASH_ENTITIES.map((ent) => (
              <TabsTrigger
                key={ent.key}
                value={ent.key}
                className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white h-10 px-4 text-xs font-semibold tracking-wider uppercase"
                data-testid={`trash-tab-${ent.key}`}
              >
                {ent.label}
                {(rowsByKey[ent.key] || []).length > 0 && (
                  <span className={cn("ml-2 px-1.5 py-0.5 text-[10px] rounded", activeTab === ent.key ? "bg-white text-stone-900" : "bg-stone-200")}>
                    {(rowsByKey[ent.key] || []).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TRASH_ENTITIES.map((ent) => (
            <TabsContent key={ent.key} value={ent.key} className="mt-4">
              {/* Filter bar */}
              <div className="bg-white border border-stone-200 px-4 py-3 flex items-center gap-2 flex-wrap">
                <Search className="w-4 h-4 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${ent.label.toLowerCase()}…`}
                  className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 max-w-xs"
                  data-testid={`trash-search-${ent.key}`}
                />
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-xs text-stone-500 mr-2">Total: <b>{visible.length}</b></span>
                  {selCount > 0 && (
                    <>
                      <span className="text-xs text-stone-500 mr-1">Selected: <b>{selCount}</b></span>
                      <Button size="sm" variant="outline" onClick={handleBulkRestore} className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs" data-testid="trash-bulk-restore">
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Bulk Restore
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="outline" onClick={handleBulkPurge} className="rounded-none border-rose-300 text-rose-700 hover:bg-rose-50 h-8 text-xs" data-testid="trash-bulk-purge">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Bulk Purge
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={clearSelection} className="rounded-none h-8 text-xs text-stone-500">
                        <X className="w-3.5 h-3.5 mr-1" /> Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="bg-white border border-stone-200 border-t-0 p-8 text-center text-sm text-stone-500">Loading…</div>
              ) : visible.length === 0 ? (
                <div className="bg-white border border-stone-200 border-t-0 p-12 text-center text-sm text-stone-500" data-testid={`trash-empty-${ent.key}`}>
                  <ShieldAlert className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  Trash is empty in {ent.label}.
                </div>
              ) : (
                <div className="bg-white border border-stone-200 border-t-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-3 py-3 w-8">
                          <input
                            type="checkbox"
                            onChange={(e) => toggleAll(e.target.checked)}
                            checked={visible.length > 0 && selCount === visible.length}
                            data-testid={`trash-select-all-${ent.key}`}
                          />
                        </th>
                        <th className="px-4 py-3 label-uppercase">Name / Ref</th>
                        <th className="px-4 py-3 label-uppercase">Deleted At</th>
                        <th className="px-4 py-3 label-uppercase">Deleted By</th>
                        <th className="px-4 py-3 label-uppercase">Created By</th>
                        <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {visible.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50" data-testid={`trash-row-${r.id}`}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={!!sel[r.id]}
                              onChange={() => toggleSelect(r.id)}
                              data-testid={`trash-checkbox-${r.id}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-stone-900">
                            {r[ent.labelField] || <span className="text-stone-400">—</span>}
                            <div className="text-[11px] text-stone-500 font-mono">{r.id?.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3 text-stone-700 text-xs">{r.deleted_at ? formatDateTime(r.deleted_at) : "—"}</td>
                          <td className="px-4 py-3 text-stone-700 text-xs">{r.deleted_profile?.full_name || r.deleted_profile?.email || "—"}</td>
                          <td className="px-4 py-3 text-stone-700 text-xs">{r.creator?.full_name || r.creator?.email || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleRestore(r)} className="rounded-none border-stone-300 hover:bg-emerald-50 hover:text-emerald-700 h-7 text-xs" data-testid={`trash-restore-${r.id}`}>
                                <RotateCcw className="w-3 h-3 mr-1" /> Restore
                              </Button>
                              {isAdmin && (
                                <Button size="sm" variant="outline" onClick={() => handlePurge(r)} className="rounded-none border-rose-300 text-rose-700 hover:bg-rose-50 h-7 text-xs" data-testid={`trash-purge-${r.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Purge
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </PageBody>
    </div>
  );
}
