import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, MapPin, Wallet, MoreVertical,
  Upload, FileImage, IdCard, ImageOff, Hammer, MessageCircle, IndianRupee, Copy,
} from "lucide-react";
import {
  fetchVendorById, fetchVendorPayments, deleteVendor, deleteVendorPayment, uploadVendorDoc,
} from "@/services/vendorService";
import { fetchProjects } from "@/services/projectService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, formatDateTime } from "@/utils/format";
import VendorFormDialog from "@/components/vendors/VendorFormDialog";
import VendorPaymentDialog from "@/components/vendors/VendorPaymentDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VendorDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [defaultProjectId, setDefaultProjectId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [v, p, pr] = await Promise.all([
        fetchVendorById(id),
        fetchVendorPayments(id),
        fetchProjects().catch(() => []),
      ]);
      setVendor(v); setPayments(p); setProjects(pr);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const byProject = {};
    payments.forEach((p) => {
      const key = p.project?.id || "_none";
      const name = p.project?.project_name || "(Unassigned)";
      if (!byProject[key]) byProject[key] = { id: key === "_none" ? null : key, name, count: 0, total: 0, last: null };
      byProject[key].count += 1;
      byProject[key].total += Number(p.amount || 0);
      const d = p.payment_date || p.created_at;
      if (!byProject[key].last || new Date(d) > new Date(byProject[key].last)) byProject[key].last = d;
    });
    return { total, byProject: Object.values(byProject).sort((a, b) => b.total - a.total) };
  }, [payments]);

  if (loading) return <div className="p-12 text-center text-sm text-stone-500">Loading vendor…</div>;
  if (!vendor) return <div className="p-12 text-center text-sm text-stone-500">Vendor not found.</div>;

  const phoneClean = (vendor.phone || "").replace(/\D/g, "");

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${vendor.name}"? This will also delete all their payment history. This cannot be undone.`)) return;
    try { await deleteVendor(vendor.id); toast.success("Vendor deleted"); nav("/vendors"); }
    catch (e) { toast.error(e.message); }
  };
  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete payment of ${formatINR(p.amount)} dated ${formatDate(p.payment_date)}?`)) return;
    try { await deleteVendorPayment(p.id); toast.success("Payment deleted"); load(); }
    catch (e) { toast.error(e.message); }
  };
  const openPayWith = (projectId) => { setDefaultProjectId(projectId || null); setPayOpen(true); };
  const copy = (text) => { if (!text) return; navigator.clipboard.writeText(text); toast.success("Copied"); };

  return (
    <div data-testid="vendor-detail-page">
      <PageHeader
        subtitle={`Vendor · ${vendor.type || "—"}`}
        title={vendor.name}
        actions={
          <>
            <Link to="/vendors"><Button variant="outline" className="rounded-none border-stone-300"><ArrowLeft className="w-4 h-4 mr-1" />All Vendors</Button></Link>
            <Button onClick={() => setEditOpen(true)} variant="outline" className="rounded-none border-stone-300" data-testid="vendor-edit-button"><Pencil className="w-4 h-4 mr-1" />Edit</Button>
            <Button onClick={() => openPayWith(null)} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="vendor-pay-button"><Wallet className="w-4 h-4 mr-1" />Pay</Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-none border-stone-300" data-testid="vendor-more-actions"><MoreVertical className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                  <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={handleDelete} data-testid="vendor-delete-button">
                    <Trash2 className="w-4 h-4 mr-2" />Delete vendor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <PageBody>
        {/* Top KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 grid-divider-x border border-stone-200 bg-stone-200">
          <KpiCard label="Total Paid" value={formatINR(stats.total)} accent="text-stone-900" />
          <KpiCard label="Payments" value={payments.length} accent="text-stone-900" />
          <KpiCard label="Projects" value={stats.byProject.length} accent="text-blue-700" />
          <KpiCard label="Last Payment" value={payments[0] ? formatDate(payments[0].payment_date) : "—"} accent="text-stone-900" small />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 mt-6">
          {/* LEFT — Profile / Payment / Docs */}
          <div className="space-y-6">
            <ProfileCard vendor={vendor} phoneClean={phoneClean} onCopy={copy} />
            <PaymentCard vendor={vendor} onCopy={copy} />
            <DocsCard vendor={vendor} onUploaded={load} />
          </div>

          {/* RIGHT — Project Ledger + Payments Log */}
          <div className="space-y-6">
            <Tabs defaultValue="ledger">
              <TabsList className="rounded-none bg-white border border-stone-300 p-0 h-10">
                <TabsTrigger value="ledger" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-ledger">Project Ledger</TabsTrigger>
                <TabsTrigger value="log" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-log">Payment Log</TabsTrigger>
              </TabsList>

              <TabsContent value="ledger" className="mt-4">
                {stats.byProject.length === 0 ? (
                  <EmptyHint label="No payments yet for this vendor" />
                ) : (
                  <div className="bg-white border border-stone-200 overflow-x-auto">
                    <table className="w-full text-sm" data-testid="vendor-ledger-table">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr className="text-left">
                          <th className="px-4 py-3 label-uppercase">Project</th>
                          <th className="px-4 py-3 label-uppercase">Last Payment</th>
                          <th className="px-4 py-3 label-uppercase text-right">Payments</th>
                          <th className="px-4 py-3 label-uppercase text-right">Total Paid</th>
                          <th className="px-4 py-3 label-uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="grid-divider-y">
                        {stats.byProject.map((p) => (
                          <tr key={p.id || "_none"} className="hover:bg-stone-50" data-testid={`ledger-row-${p.id || "none"}`}>
                            <td className="px-4 py-3">
                              {p.id ? (
                                <Link to={`/projects/${p.id}`} className="font-medium text-stone-900 hover:text-orange-600 inline-flex items-center gap-1.5">
                                  <Hammer className="w-3.5 h-3.5" />{p.name}
                                </Link>
                              ) : (
                                <span className="text-stone-500 italic">{p.name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDate(p.last)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{p.count}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(p.total)}</td>
                            <td className="px-4 py-3 text-right">
                              <Button onClick={() => openPayWith(p.id)} variant="outline" size="sm" className="rounded-none border-stone-300 h-7 text-xs" data-testid={`ledger-pay-${p.id || "none"}`}>
                                <Wallet className="w-3 h-3 mr-1" />Pay
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-stone-900 text-white">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 label-uppercase text-stone-400">Total Paid</td>
                          <td className="px-4 py-3 text-right font-display text-lg tabular-nums">{formatINR(stats.total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="log" className="mt-4">
                {payments.length === 0 ? (
                  <EmptyHint label="No payments logged" />
                ) : (
                  <div className="bg-white border border-stone-200 overflow-x-auto">
                    <table className="w-full text-sm" data-testid="vendor-log-table">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr className="text-left">
                          <th className="px-4 py-3 label-uppercase">Date</th>
                          <th className="px-4 py-3 label-uppercase">Project</th>
                          <th className="px-4 py-3 label-uppercase">Note</th>
                          <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                          <th className="px-4 py-3 label-uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="grid-divider-y">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-stone-50" data-testid={`log-row-${p.id}`}>
                            <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDateTime(p.payment_date)}</td>
                            <td className="px-4 py-3 text-stone-700">
                              {p.project ? <Link to={`/projects/${p.project.id}`} className="hover:text-orange-600">{p.project.project_name}</Link> : <span className="text-stone-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-stone-700">{p.note || "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(p.amount)}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleDeletePayment(p)} title="Delete" className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600" data-testid={`log-delete-${p.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </PageBody>

      <VendorFormDialog open={editOpen} onOpenChange={setEditOpen} vendor={vendor} onSaved={load} />
      <VendorPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        vendors={[vendor]}
        projects={projects}
        defaultVendorId={vendor.id}
        defaultProjectId={defaultProjectId}
        lockVendor
        onSaved={load}
      />
    </div>
  );
}

function KpiCard({ label, value, accent, small }) {
  return (
    <div className="bg-white p-4">
      <div className="label-uppercase">{label}</div>
      <div className={cn("font-display tabular-nums truncate mt-1", small ? "text-base" : "text-xl", accent)}>{value}</div>
    </div>
  );
}

function ProfileCard({ vendor, phoneClean, onCopy }) {
  const photoOk = Boolean(vendor.photo_url);
  return (
    <div className="bg-white border border-stone-200" data-testid="vendor-profile-card">
      <div className="px-4 py-3 border-b border-stone-200 label-uppercase">Profile</div>
      <div className="p-4 flex items-start gap-4">
        <div className="w-20 h-20 bg-stone-100 border border-stone-200 grid place-items-center overflow-hidden shrink-0">
          {photoOk ? (
            <img src={vendor.photo_url} alt={vendor.name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-stone-300 text-xl font-bold">{(vendor.name || "?").slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-tight truncate">{vendor.name}</div>
          {vendor.type && <div className="text-xs tracking-widest uppercase text-orange-600 font-semibold mt-0.5">{vendor.type}</div>}
        </div>
      </div>
      <div className="border-t border-stone-100 grid-divider-y">
        {vendor.phone && (
          <Row icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={vendor.phone} actions={
            <>
              <a href={`tel:${phoneClean}`} className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-900"><Phone className="w-3.5 h-3.5" /></a>
              <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-emerald-50 text-stone-500 hover:text-emerald-700"><MessageCircle className="w-3.5 h-3.5" /></a>
            </>
          } />
        )}
        {vendor.email && <Row icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={vendor.email} onCopy={() => onCopy(vendor.email)} />}
        {vendor.address && <Row icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={vendor.address} />}
        {vendor.gst_no && <Row label="GST" value={vendor.gst_no} mono onCopy={() => onCopy(vendor.gst_no)} />}
        {vendor.pan_no && <Row label="PAN" value={vendor.pan_no} mono onCopy={() => onCopy(vendor.pan_no)} />}
        {vendor.aadhar_no && <Row label="Aadhar" value={vendor.aadhar_no} mono onCopy={() => onCopy(vendor.aadhar_no)} />}
        {vendor.notes && <Row label="Notes" value={vendor.notes} multiline />}
      </div>
    </div>
  );
}

function PaymentCard({ vendor, onCopy }) {
  const has = vendor.upi_id || vendor.account_no || vendor.ifsc || vendor.bank_name || vendor.account_holder;
  return (
    <div className="bg-white border border-stone-200" data-testid="vendor-payment-card">
      <div className="px-4 py-3 border-b border-stone-200 label-uppercase flex items-center gap-1.5"><IndianRupee className="w-3 h-3" />Payment Details</div>
      {!has ? (
        <div className="px-4 py-6 text-center text-xs text-stone-400 italic">No payment details yet — click Edit to add UPI / bank details.</div>
      ) : (
        <div className="grid-divider-y">
          {vendor.upi_id && <Row label="UPI" value={vendor.upi_id} mono accent="text-emerald-700" onCopy={() => onCopy(vendor.upi_id)} />}
          {vendor.account_holder && <Row label="A/C Holder" value={vendor.account_holder} />}
          {vendor.account_no && <Row label="Bank A/C" value={vendor.account_no} mono onCopy={() => onCopy(vendor.account_no)} />}
          {vendor.ifsc && <Row label="IFSC" value={vendor.ifsc} mono onCopy={() => onCopy(vendor.ifsc)} />}
          {vendor.bank_name && <Row label="Bank" value={vendor.bank_name} />}
        </div>
      )}
    </div>
  );
}

function DocsCard({ vendor, onUploaded }) {
  return (
    <div className="bg-white border border-stone-200" data-testid="vendor-docs-card">
      <div className="px-4 py-3 border-b border-stone-200 label-uppercase">Documents</div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <DocSlot vendorId={vendor.id} kind="photo" label="Photo" url={vendor.photo_url} icon={<FileImage className="w-5 h-5" />} onUploaded={onUploaded} />
        <DocSlot vendorId={vendor.id} kind="id_card" label="ID Card" url={vendor.id_card_url} icon={<IdCard className="w-5 h-5" />} onUploaded={onUploaded} />
        <DocSlot vendorId={vendor.id} kind="visiting_card" label="Card" url={vendor.visiting_card_url} icon={<FileImage className="w-5 h-5" />} onUploaded={onUploaded} />
      </div>
    </div>
  );
}

function DocSlot({ vendorId, kind, label, url, icon, onUploaded }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    setBusy(true);
    try { await uploadVendorDoc(vendorId, kind, file); toast.success(`${label} uploaded`); onUploaded?.(); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div>
      <div className="aspect-square bg-stone-50 border border-stone-200 overflow-hidden grid place-items-center">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full"><img src={url} alt={label} className="w-full h-full object-cover" /></a>
        ) : (
          <div className="text-stone-300 flex flex-col items-center gap-1">
            {icon || <ImageOff className="w-5 h-5" />}
            <div className="text-[10px] tracking-widest uppercase font-semibold">No file</div>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={onChange} className="hidden" data-testid={`doc-input-${kind}`} />
      <Button onClick={() => ref.current?.click()} disabled={busy} variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100 mt-2 w-full text-xs h-7" data-testid={`doc-upload-${kind}`}>
        <Upload className="w-3 h-3 mr-1" />{busy ? "Uploading…" : url ? "Replace" : label}
      </Button>
    </div>
  );
}

function Row({ icon, label, value, actions, mono, multiline, accent, onCopy }) {
  if (!value) return null;
  return (
    <div className="px-4 py-2.5 flex items-start gap-2">
      <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-500 inline-flex items-center gap-1 min-w-[80px] pt-0.5">
        {icon}{label}
      </div>
      <div className={cn("flex-1 min-w-0 text-sm break-words", mono && "font-mono", multiline ? "whitespace-pre-wrap" : "truncate", accent || "text-stone-900")}>{value}</div>
      <div className="flex items-center gap-0.5">
        {onCopy && <button onClick={onCopy} title="Copy" className="p-1 hover:bg-stone-100 text-stone-400 hover:text-stone-900"><Copy className="w-3.5 h-3.5" /></button>}
        {actions}
      </div>
    </div>
  );
}

function EmptyHint({ label }) {
  return <div className="bg-white border border-stone-200 p-10 text-center text-sm text-stone-500">{label}</div>;
}
