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
  Plus, Search, Truck, Wallet, MoreVertical, Pencil, Trash2, ArrowRight, Phone, MessageCircle, Download, FileSpreadsheet, Printer, ChevronDown, X,
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

  // Payment log filters
  const [pmtProjectFilter, setPmtProjectFilter] = useState("all");   // "all" | "none" | projectId
  const [pmtVendorFilter, setPmtVendorFilter] = useState("all");
  const [pmtFrom, setPmtFrom] = useState("");
  const [pmtTo, setPmtTo] = useState("");
  const [pmtSearch, setPmtSearch] = useState("");

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

  // Filtered payments (project / vendor / date-range / search)
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (pmtProjectFilter === "none") { if (p.project?.id) return false; }
      else if (pmtProjectFilter !== "all" && p.project?.id !== pmtProjectFilter) return false;
      if (pmtVendorFilter !== "all" && p.vendor?.id !== pmtVendorFilter) return false;
      if (pmtFrom && p.payment_date && new Date(p.payment_date) < new Date(pmtFrom)) return false;
      if (pmtTo) {
        const end = new Date(pmtTo); end.setHours(23,59,59,999);
        if (p.payment_date && new Date(p.payment_date) > end) return false;
      }
      if (pmtSearch) {
        const s = pmtSearch.toLowerCase();
        const hay = [p.vendor?.name, p.vendor?.type, p.project?.project_name, p.note].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [payments, pmtProjectFilter, pmtVendorFilter, pmtFrom, pmtTo, pmtSearch]);
  const filteredTotal = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const projectBreakdown = useMemo(() => {
    const map = new Map();
    filteredPayments.forEach((p) => {
      const key = p.project?.id || "__none__";
      const name = p.project?.project_name || "(No Project)";
      const cur = map.get(key) || { name, count: 0, total: 0 };
      cur.count += 1; cur.total += Number(p.amount || 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredPayments]);

  const clearPmtFilters = () => {
    setPmtProjectFilter("all"); setPmtVendorFilter("all"); setPmtFrom(""); setPmtTo(""); setPmtSearch("");
  };
  const hasPmtFilters = pmtProjectFilter !== "all" || pmtVendorFilter !== "all" || pmtFrom || pmtTo || pmtSearch;

  // -------- Exports --------
  const exportPaymentsCSV = () => {
    if (!filteredPayments.length) { toast.info("No payments to export"); return; }
    const headers = ["Date","Vendor","Vendor Type","Project","Note","Amount"];
    const rows = filteredPayments.map((p) => [
      p.payment_date ? formatDate(p.payment_date) : "",
      p.vendor?.name || "",
      p.vendor?.type || "",
      p.project?.project_name || "",
      (p.note || "").replace(/[\r\n]+/g, " "),
      Number(p.amount || 0),
    ]);
    const csv = [headers, ...rows, [], ["", "", "", "", "TOTAL", filteredTotal]]
      .map((r) => r.map((c) => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendor-payments-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredPayments.length} payments`);
  };

  const exportPaymentsPDF = () => {
    if (!filteredPayments.length) { toast.info("No payments to export"); return; }
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) { toast.error("Popup blocked — allow popups to print"); return; }
    const rowsHTML = filteredPayments.map((p) => `
      <tr>
        <td>${p.payment_date ? formatDate(p.payment_date) : ""}</td>
        <td>${escapeHtml(p.vendor?.name || "")}<div class="muted">${escapeHtml(p.vendor?.type || "")}</div></td>
        <td>${escapeHtml(p.project?.project_name || "—")}</td>
        <td>${escapeHtml(p.note || "—")}</td>
        <td class="right mono">${formatINR(p.amount)}</td>
      </tr>`).join("");
    const breakdownHTML = projectBreakdown.map((b) => `
      <tr><td>${escapeHtml(b.name)}</td><td class="right">${b.count}</td><td class="right mono">${formatINR(b.total)}</td></tr>
    `).join("");
    const filterChips = [
      pmtProjectFilter !== "all" && `Project: ${pmtProjectFilter === "none" ? "(No Project)" : (projects.find((x)=>x.id===pmtProjectFilter)?.project_name || "—")}`,
      pmtVendorFilter !== "all" && `Vendor: ${vendors.find((x)=>x.id===pmtVendorFilter)?.name || "—"}`,
      pmtFrom && `From: ${formatDate(pmtFrom)}`,
      pmtTo && `To: ${formatDate(pmtTo)}`,
      pmtSearch && `Search: "${pmtSearch}"`,
    ].filter(Boolean).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Vendor Payment Report</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px}
        h1{font-size:22px;margin:0 0 4px;color:#1e3a8a}
        .sub{color:#64748b;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:16px}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1e3a8a;padding-bottom:12px;margin-bottom:18px}
        .brand{font-size:18px;font-weight:700;color:#1e3a8a}
        .chip{display:inline-block;background:#fef9e7;border:1px solid #d4a017;color:#a87d0a;padding:2px 8px;border-radius:99px;font-size:10px;margin:2px 4px 2px 0;font-weight:600}
        .kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:14px 0 22px}
        .kpi{border:1px solid #cbd5e1;padding:12px;background:#f8fafc}
        .kpi .lbl{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700}
        .kpi .val{font-size:20px;font-weight:800;color:#1e3a8a;margin-top:4px;font-family:'JetBrains Mono',monospace}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#1e3a8a;color:#fff;text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:700}
        tr:nth-child(even) td{background:#f8fafc}
        .right{text-align:right}
        .mono{font-family:'JetBrains Mono',monospace;font-weight:700}
        .muted{color:#64748b;font-size:10px}
        h3{margin:22px 0 6px;font-size:13px;color:#1e3a8a;text-transform:uppercase;letter-spacing:.14em}
        .totals-row td{background:#1e3a8a;color:#fff;font-weight:800}
        .footer{margin-top:26px;font-size:10px;color:#64748b;border-top:1px solid #cbd5e1;padding-top:10px;display:flex;justify-content:space-between}
        @media print{ .noprint{display:none} }
        button{padding:8px 14px;background:#1e3a8a;color:#fff;border:0;cursor:pointer;font-weight:600}
      </style>
      </head><body>
      <div class="noprint" style="margin-bottom:14px"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
      <div class="head">
        <div>
          <div class="brand">Sankalp Group · Business Solutions</div>
          <h1>Vendor Payment Report</h1>
          <div class="sub">Generated ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <div style="text-align:right">${filterChips || '<span class="chip">All Payments</span>'}</div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="lbl">Entries</div><div class="val">${filteredPayments.length}</div></div>
        <div class="kpi"><div class="lbl">Projects Covered</div><div class="val">${projectBreakdown.length}</div></div>
        <div class="kpi"><div class="lbl">Total Paid</div><div class="val">${formatINR(filteredTotal)}</div></div>
      </div>
      <h3>Project-wise Breakdown</h3>
      <table><thead><tr><th>Project</th><th class="right">Payments</th><th class="right">Total</th></tr></thead>
        <tbody>${breakdownHTML}</tbody></table>
      <h3>Payment Details</h3>
      <table><thead><tr><th>Date</th><th>Vendor</th><th>Project</th><th>Note</th><th class="right">Amount</th></tr></thead>
        <tbody>${rowsHTML}
          <tr class="totals-row"><td colspan="4" class="right">TOTAL</td><td class="right mono">${formatINR(filteredTotal)}</td></tr>
        </tbody></table>
      <div class="footer">
        <div>Sankalp Group · Business Solutions</div>
        <div>© ${new Date().getFullYear()} — Confidential internal document</div>
      </div>
      </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch(_){ /* noop */ } }, 400);
  };

  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

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
            {/* Filter bar */}
            <div className="bg-white border border-stone-200 grid grid-cols-1 md:grid-cols-6 gap-0 grid-divider-x">
              <div className="px-4 py-3 md:col-span-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-stone-400" />
                <Input
                  value={pmtSearch}
                  onChange={(e) => setPmtSearch(e.target.value)}
                  placeholder="Search vendor / project / note…"
                  className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8"
                  data-testid="pmt-search"
                />
                {hasPmtFilters && (
                  <Button variant="ghost" size="sm" onClick={clearPmtFilters} className="rounded-none text-xs text-stone-500 hover:text-stone-900 h-7" data-testid="pmt-clear">
                    <X className="w-3 h-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
              <div className="px-4 py-2">
                <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Project</div>
                <Select value={pmtProjectFilter} onValueChange={setPmtProjectFilter}>
                  <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="pmt-project-filter"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none max-h-[300px]">
                    <SelectItem value="all" className="rounded-none">All Projects</SelectItem>
                    <SelectItem value="none" className="rounded-none">— No Project —</SelectItem>
                    {projects.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id} className="rounded-none">{pr.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="px-4 py-2">
                <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Vendor</div>
                <Select value={pmtVendorFilter} onValueChange={setPmtVendorFilter}>
                  <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="pmt-vendor-filter"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none max-h-[300px]">
                    <SelectItem value="all" className="rounded-none">All Vendors</SelectItem>
                    {vendors.map((vv) => (
                      <SelectItem key={vv.id} value={vv.id} className="rounded-none">{vv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="px-4 py-2">
                <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">From</div>
                <Input type="date" value={pmtFrom} onChange={(e) => setPmtFrom(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-8" data-testid="pmt-from" />
              </div>
              <div className="px-4 py-2">
                <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">To</div>
                <Input type="date" value={pmtTo} onChange={(e) => setPmtTo(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-8" data-testid="pmt-to" />
              </div>
            </div>

            {/* KPI + Export bar */}
            <div className="bg-white border border-stone-200 border-t-0 px-4 py-3 flex items-center gap-2 flex-wrap">
              <Chip data-testid="pmt-count-chip">Showing: {filteredPayments.length} of {payments.length}</Chip>
              <Chip className="bg-stone-900 text-white border-stone-900" data-testid="pmt-total-chip">Filtered Total: {formatINR(filteredTotal)}</Chip>
              <Chip>All-time Total: {formatINR(totalPaid)}</Chip>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={exportPaymentsCSV} className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs font-semibold" data-testid="pmt-export-csv">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Export Excel/CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportPaymentsPDF} className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs font-semibold" data-testid="pmt-export-pdf">
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print / PDF
                </Button>
              </div>
            </div>

            {/* Project-wise breakdown card (only visible when >1 project) */}
            {projectBreakdown.length > 1 && (
              <div className="bg-white border border-stone-200 border-t-0 px-4 py-3">
                <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">Project-wise Breakdown</div>
                <div className="flex flex-wrap gap-2">
                  {projectBreakdown.map((b, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 border border-stone-300 bg-stone-50 text-xs">
                      <span className="font-medium text-stone-900">{b.name}</span>
                      <span className="text-stone-500">·</span>
                      <span className="text-stone-600">{b.count} pmt</span>
                      <span className="text-stone-500">·</span>
                      <span className="font-semibold text-orange-700 tabular-nums">{formatINR(b.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              {filteredPayments.length === 0 ? (
                <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500" data-testid="vendor-payments-empty">
                  {payments.length === 0 ? "No vendor payments recorded." : "No payments match your filters."}
                </div>
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
                      {filteredPayments.map((p) => (
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
                      <tr className="bg-stone-900 text-white">
                        <td colSpan={4} className="px-4 py-3 text-right label-uppercase">Filtered Total</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold">{formatINR(filteredTotal)}</td>
                        <td></td>
                      </tr>
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
