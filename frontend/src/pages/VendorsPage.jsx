import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Chip } from "@/components/shared/StatusBadge";
import {
  Plus, Search, Truck, Wallet, MoreVertical, Pencil, Trash2, ArrowRight, Phone, MessageCircle,
} from "lucide-react";
import {
  fetchVendors, fetchVendorPayments, deleteVendor, deleteVendorPayment,
} from "@/services/vendorService";
import { fetchProjects } from "@/services/projectService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, VENDOR_TYPES } from "@/utils/format";
import VendorFormDialog from "@/components/vendors/VendorFormDialog";
import VendorPaymentDialog from "@/components/vendors/VendorPaymentDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VendorsPage() {
  const { isAdmin } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [vOpen, setVOpen] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [pOpen, setPOpen] = useState(false);
  const [presetVendor, setPresetVendor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [v, p, pr] = await Promise.all([
        fetchVendors(),
        fetchVendorPayments(),
        fetchProjects().catch(() => []),
      ]);
      setVendors(v); setPayments(p); setProjects(pr);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filteredVendors = useMemo(() => vendors.filter((v) => {
    if (typeFilter !== "all" && v.type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [v.name, v.type, v.phone, v.upi_id, v.email].filter(Boolean).join(" ").toLowerCase().includes(s);
  }), [vendors, search, typeFilter]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Permanently delete "${vendor.name}"? This will also delete all their payment history.`)) return;
    try { await deleteVendor(vendor.id); toast.success("Vendor deleted"); load(); }
    catch (e) { toast.error(e.message); }
  };
  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete this payment of ${formatINR(p.amount)}?`)) return;
    try { await deleteVendorPayment(p.id); toast.success("Payment deleted"); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="vendors-page">
      <PageHeader
        subtitle="Phase 6"
        title="Vendor Management"
        actions={
          <>
            <Button variant="outline" onClick={() => { setPresetVendor(null); setPOpen(true); }} className="rounded-none border-stone-300 hover:bg-stone-100" data-testid="vendor-payment-button"><Wallet className="w-4 h-4 mr-1" />Record Payment</Button>
            <Button onClick={() => { setEditVendor(null); setVOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="vendor-add-button"><Plus className="w-4 h-4" />New Vendor</Button>
          </>
        }
      />
      <PageBody>
        <Tabs defaultValue="vendors">
          <TabsList className="rounded-none bg-white border border-stone-300 p-0 h-10">
            <TabsTrigger value="vendors" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-vendors">Vendors</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="mt-4">
            <div className="bg-white border border-stone-200 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-0 grid-divider-x">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="w-4 h-4 text-stone-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, UPI, email…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8" data-testid="vendors-search" />
              </div>
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="label-uppercase">Type</span>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="rounded-none w-[160px] border-stone-300 h-9" data-testid="vendors-type-filter"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="all" className="rounded-none">All</SelectItem>
                    {VENDOR_TYPES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="px-4 py-3 flex items-center"><Chip>Total: {filteredVendors.length}</Chip></div>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
              ) : filteredVendors.length === 0 ? (
                <div className="bg-white border border-stone-200 p-12 text-center" data-testid="vendors-empty">
                  <Truck className="w-10 h-10 mx-auto text-stone-300" />
                  <div className="font-display text-xl font-bold tracking-tight mt-3">No vendors yet</div>
                  <p className="text-sm text-stone-500 mt-2">Add carpenters, painters, electricians and more.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 grid-divider-x grid-divider-y border border-stone-200 bg-stone-200">
                  {filteredVendors.map((v) => {
                    const vp = payments.filter((p) => p.vendor_id === v.id);
                    const sum = vp.reduce((s, p) => s + Number(p.amount || 0), 0);
                    const projectIds = new Set(vp.map((p) => p.project_id).filter(Boolean));
                    const phoneClean = (v.phone || "").replace(/\D/g, "");
                    return (
                      <div key={v.id} className="bg-white p-5 group" data-testid={`vendor-card-${v.id}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-stone-100 border border-stone-200 grid place-items-center overflow-hidden shrink-0">
                            {v.photo_url ? (
                              <img src={v.photo_url} alt={v.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-stone-400 font-bold">{(v.name || "?").slice(0, 1).toUpperCase()}</div>
                            )}
                          </div>
                          <Link to={`/vendors/${v.id}`} className="min-w-0 flex-1">
                            <div className="font-display text-base font-semibold tracking-tight leading-tight truncate hover:text-orange-600 transition-colors">{v.name}</div>
                            <div className="text-xs tracking-widest uppercase text-orange-600 font-semibold mt-0.5 truncate">{v.type || "—"}</div>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-none h-7 w-7 hover:bg-stone-100" data-testid={`vendor-actions-${v.id}`}><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                              <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => { setEditVendor(v); setVOpen(true); }} data-testid={`vendor-edit-${v.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleDelete(v)} data-testid={`vendor-delete-${v.id}`}>
                                    <Trash2 className="w-4 h-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="text-xs text-stone-700 mt-3 flex items-center gap-2">
                          <Phone className="w-3 h-3 text-stone-400" />{v.phone || "—"}
                          {phoneClean && (
                            <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="ml-auto p-1 hover:bg-emerald-50 text-stone-400 hover:text-emerald-700"><MessageCircle className="w-3.5 h-3.5" /></a>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-0 mt-4 border-t border-stone-200 pt-3 grid-divider-x">
                          <div>
                            <div className="label-uppercase text-stone-500">Paid</div>
                            <div className="font-medium text-sm mt-0.5 tabular-nums">{formatINR(sum)}</div>
                          </div>
                          <div className="pl-3">
                            <div className="label-uppercase text-stone-500">Pmts</div>
                            <div className="text-sm mt-0.5">{vp.length}</div>
                          </div>
                          <div className="pl-3">
                            <div className="label-uppercase text-stone-500">Projects</div>
                            <div className="text-sm mt-0.5">{projectIds.size}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100 flex-1" onClick={() => { setPresetVendor(v.id); setPOpen(true); }} data-testid={`vendor-pay-${v.id}`}>
                            <Wallet className="w-3.5 h-3.5 mr-1" />Pay
                          </Button>
                          <Link to={`/vendors/${v.id}`} className={cn("inline-flex items-center justify-center px-3 h-8 border border-stone-300 hover:bg-stone-100 text-stone-700 hover:text-stone-900 transition-colors text-xs tracking-widest uppercase font-semibold")}>
                            View <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <div className="bg-white border border-stone-200 px-4 py-3 flex items-center gap-2 flex-wrap">
              <Chip>Entries: {payments.length}</Chip>
              <Chip className="bg-stone-900 text-white border-stone-900">Total: {formatINR(totalPaid)}</Chip>
            </div>
            <div className="mt-4">
              {payments.length === 0 ? (
                <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500" data-testid="vendor-payments-empty">No vendor payments recorded.</div>
              ) : (
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="vendor-payments-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Date</th>
                        <th className="px-4 py-3 label-uppercase">Vendor</th>
                        <th className="px-4 py-3 label-uppercase">Project</th>
                        <th className="px-4 py-3 label-uppercase">Note</th>
                        <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                        <th className="px-4 py-3 label-uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50" data-testid={`payment-row-${p.id}`}>
                          <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                          <td className="px-4 py-3">
                            <Link to={`/vendors/${p.vendor?.id}`} className="font-medium hover:text-orange-600">{p.vendor?.name}</Link>
                            <div className="text-xs text-stone-500">{p.vendor?.type}</div>
                          </td>
                          <td className="px-4 py-3 text-stone-700">
                            {p.project ? <Link to={`/projects/${p.project.id}`} className="hover:text-orange-600">{p.project.project_name}</Link> : "—"}
                          </td>
                          <td className="px-4 py-3 text-stone-700">{p.note || "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(p.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDeletePayment(p)} title="Delete" className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600" data-testid={`payment-delete-${p.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PageBody>

      <VendorFormDialog
        open={vOpen}
        onOpenChange={(v) => { setVOpen(v); if (!v) setEditVendor(null); }}
        vendor={editVendor}
        onSaved={load}
      />
      <VendorPaymentDialog
        open={pOpen}
        onOpenChange={setPOpen}
        vendors={vendors}
        projects={projects}
        defaultVendorId={presetVendor}
        onSaved={load}
      />
    </div>
  );
}
