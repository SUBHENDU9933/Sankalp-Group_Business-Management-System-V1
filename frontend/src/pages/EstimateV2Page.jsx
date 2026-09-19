import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/shared/StatusBadge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatINR } from "@/utils/format";

const VERSION = 2;
const MODULE = "estimate_v2";
const blankRow = () => ({ id: crypto.randomUUID(), room: "", description: "", specification: "", unit: "Sq.Ft", qty: "", rate: "" });
const emptyRecord = () => ({
  meta: { estNo: "", date: new Date().toISOString(), customerName: "", phone: "", email: "", work: "", address: "", budget: "" },
  rows: [blankRow()],
  financials: { discountType: "amount", discount: 0, gstEnabled: false, gstRate: 18 },
});

export default function EstimateV2Page() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const estimateId = params.get("estimateId") || params.get("id");
  const leadId = params.get("leadId") || params.get("lead_id");
  const [record, setRecord] = useState(emptyRecord);
  const [loading, setLoading] = useState(Boolean(estimateId));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentId, setCurrentId] = useState(estimateId || null);
  const [lead, setLead] = useState(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState([]);
  const [leadSearching, setLeadSearching] = useState(false);

  const subtotal = useMemo(() => record.rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0), [record.rows]);
  const discount = useMemo(() => {
    const d = Number(record.financials.discount) || 0;
    return record.financials.discountType === "percent" ? subtotal * d / 100 : d;
  }, [record.financials.discount, record.financials.discountType, subtotal]);
  const taxable = Math.max(0, subtotal - discount);
  const gst = record.financials.gstEnabled ? taxable * ((Number(record.financials.gstRate) || 0) / 100) : 0;
  const grandTotal = taxable + gst;

  const setMeta = (key, value) => setRecord(r => ({ ...r, meta: { ...r.meta, [key]: value } }));
  const setFinancial = (key, value) => setRecord(r => ({ ...r, financials: { ...r.financials, [key]: value } }));
  const updateRow = (id, key, value) => setRecord(r => ({ ...r, rows: r.rows.map(row => row.id === id ? { ...row, [key]: value } : row) }));
  const addRow = () => setRecord(r => ({ ...r, rows: [...r.rows, blankRow()] }));
  const removeRow = id => setRecord(r => ({ ...r, rows: r.rows.length === 1 ? r.rows : r.rows.filter(row => row.id !== id) }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!estimateId) {
          const { data, error } = await supabase.rpc("next_estimate_no");
          if (error) throw error;
          if (!cancelled) setRecord(r => ({ ...r, meta: { ...r.meta, estNo: data } }));
          return;
        }
        const { data, error } = await supabase.from("estimates").select("*").eq("id", estimateId).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Estimate not found.");
        if (Number(data.estimator_version || 1) !== VERSION) {
          const target = data.estimator_module === "estimate_v1" ? "/estimator.html" : "/estimate-v" + (data.estimator_version || 1);
          const url = new URL(target, window.location.origin);
          url.searchParams.set("id", data.id);
          window.location.replace(url.toString());
          return;
        }
        const stored = data.data && typeof data.data === "object" ? data.data : {};
        const base = emptyRecord();
        const next = {
          ...base,
          ...stored,
          meta: { ...base.meta, ...(stored.meta || {}) },
          financials: { ...base.financials, ...(stored.financials || {}) },
          rows: Array.isArray(stored.rows) && stored.rows.length ? stored.rows.map(row => ({ ...blankRow(), ...row })) : [blankRow()],
        };
        if (!cancelled) {
          setCurrentId(data.id);
          setRecord({ ...next, meta: { ...next.meta, estNo: data.estimate_no || next.meta.estNo } });
          if (data.lead_id) {
            const { data: linkedLead } = await supabase.from("leads").select("id,name,phone,location,requirement,project_type,budget").eq("id", data.lead_id).maybeSingle();
            if (!cancelled && linkedLead) setLead(linkedLead);
          }
        }
      } catch (e) {
        if (!cancelled) toast.error("Could not load estimate: " + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [estimateId]);

  useEffect(() => {
    if (!leadId || estimateId) return;
    supabase.from("leads").select("id,name,phone,location,requirement,project_type,budget").eq("id", leadId).maybeSingle()
      .then(({ data, error }) => {
        if (error) return toast.error("Could not load lead: " + error.message);
        if (data) selectLead(data);
      });
  }, [leadId, estimateId]);

  useEffect(() => {
    const q = leadSearch.trim();
    if (q.length < 2 || lead) { setLeadResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLeadSearching(true);
      const { data, error } = await supabase.from("leads")
        .select("id,name,phone,location,requirement,project_type,budget")
        .or("name.ilike.%" + q + "%,phone.ilike.%" + q + "%")
        .order("created_at", { ascending: false }).limit(8);
      if (!cancelled) {
        setLeadSearching(false);
        if (error) toast.error("Lead search failed: " + error.message);
        else setLeadResults(data || []);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [leadSearch, lead]);

  function selectLead(item) {
    setLead(item);
    setLeadSearch("");
    setRecord(r => ({ ...r, meta: { ...r.meta, customerName: item.name || "", phone: item.phone || "", address: item.location || "", work: item.requirement || item.project_type || "", budget: item.budget ?? "" } }));
  }

  function clearLead() {
    setLead(null);
    setRecord(r => ({ ...r, meta: { ...r.meta, customerName: "", phone: "", address: "", work: "", budget: "" } }));
  }

  async function save() {
    if (!record.meta.customerName.trim()) return toast.error("Customer name is required.");
    if (!record.rows.some(r => r.description.trim() && Number(r.qty) > 0)) return toast.error("Add at least one item with description and quantity.");
    setSaving(true); setSaved(false);
    try {
      let targetId = currentId;
      let estimateNo = record.meta.estNo;
      if (targetId) {
        const { data: existing, error } = await supabase.from("estimates").select("id,estimate_no,estimator_version").eq("id", targetId).maybeSingle();
        if (error) throw error;
        if (!existing) throw new Error("Estimate no longer exists.");
        if (Number(existing.estimator_version || 1) !== VERSION) throw new Error("This estimate belongs to another estimator version.");
        estimateNo = existing.estimate_no;
      } else {
        const { data, error } = await supabase.rpc("next_estimate_no");
        if (error) throw error;
        estimateNo = data;
      }
      const payload = {
        estimate_no: estimateNo,
        lead_id: lead?.id || leadId || null,
        customer_name: record.meta.customerName.trim(),
        phone: record.meta.phone.trim() || null,
        final_amount: Math.round(grandTotal * 100) / 100,
        data: { ...record, version: VERSION, module: MODULE, meta: { ...record.meta, estNo: estimateNo }, totals: { subtotal, discount, taxable, gst, grandTotal } },
        estimator_version: VERSION,
        estimator_module: MODULE,
      };
      if (targetId) {
        const { error } = await supabase.from("estimates").update(payload).eq("id", targetId);
        if (error) throw error;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user?.id) throw new Error("Your session has expired. Please sign in again.");
        const { data, error } = await supabase.from("estimates").insert([{ ...payload, created_by: authData.user.id }]).select("id").single();
        if (error) throw error;
        targetId = data.id;
        setCurrentId(targetId);
        const url = new URL(window.location.href);
        url.searchParams.set("estimateId", targetId);
        window.history.replaceState({}, "", url.toString());
      }
      setRecord(r => ({ ...r, meta: { ...r.meta, estNo: estimateNo } }));
      setSaved(true);
      toast.success("Estimate " + estimateNo + " saved — Version 2");
    } catch (e) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-sm text-stone-500">Loading Version 2 estimator…</div>;

  return (
    <div data-testid="estimate-v2-page">
      <PageHeader
        subtitle="Phase 7 · Estimate System"
        title={estimateId ? "Edit Estimate · Version 2" : "Create Estimate · Version 2"}
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-none" onClick={() => window.location.href="/estimates"}><ArrowLeft className="w-4 h-4 mr-1" /> Estimates</Button>
          <Button variant="outline" className="rounded-none" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}{saving ? "Saving…" : "Save Estimate"}</Button>
        </div>}
      />
      <PageBody>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-3"><div className="rounded-full bg-blue-700 text-white w-9 h-9 flex items-center justify-center font-bold">V2</div><div><div className="font-semibold text-blue-950">Latest Estimate Engine</div><div className="text-xs text-blue-800">This estimate is permanently linked to Version 2.</div></div></div>
            {saved && <Chip className="bg-emerald-50 text-emerald-800 border-emerald-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Saved</Chip>}
          </div>

          <section className="bg-white border border-stone-200 p-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4"><div><div className="label-uppercase">Estimate Details</div><div className="text-xs text-stone-500 mt-1">Central estimate sequence · Version 2</div></div><div className="font-mono text-sm font-semibold">{record.meta.estNo || "Generating…"}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Estimate Date"><Input type="datetime-local" value={toLocalInput(record.meta.date)} onChange={e=>setMeta("date",e.target.value)} /></Field>
              <Field label="Customer / Lead">
                {lead ? <div className="flex gap-2"><Input value={lead.name + " · " + (lead.phone || "")} readOnly className="bg-stone-50" /><Button variant="outline" className="rounded-none" onClick={clearLead}><X className="w-4 h-4" /></Button></div> :
                <div className="relative"><Input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Search lead by name or phone…" />{leadSearching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-stone-400" />}{leadResults.length>0 && <div className="absolute z-20 left-0 right-0 top-11 bg-white border border-stone-300 shadow-lg">{leadResults.map(item=><button type="button" key={item.id} onClick={()=>selectLead(item)} className="w-full text-left px-3 py-2 hover:bg-stone-50 border-b last:border-b-0"><div className="font-medium">{item.name}</div><div className="text-xs text-stone-500">{item.phone || "No phone"} · {item.location || "No location"}</div></button>)}</div>}</div>}
              </Field>
              <Field label="Customer Name"><Input value={record.meta.customerName} onChange={e=>setMeta("customerName",e.target.value)} /></Field>
              <Field label="Phone"><Input value={record.meta.phone} onChange={e=>setMeta("phone",e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={record.meta.email} onChange={e=>setMeta("email",e.target.value)} /></Field>
              <Field label="Budget"><Input type="number" value={record.meta.budget} onChange={e=>setMeta("budget",e.target.value)} /></Field>
              <Field label="Work / Requirement" className="md:col-span-2"><Input value={record.meta.work} onChange={e=>setMeta("work",e.target.value)} /></Field>
              <Field label="Project / Customer Address" className="md:col-span-3"><Textarea value={record.meta.address} onChange={e=>setMeta("address",e.target.value)} rows={2} /></Field>
            </div>
          </section>

          <section className="bg-white border border-stone-200">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between"><div><div className="label-uppercase">Scope & Material Schedule</div><div className="text-xs text-stone-500 mt-1">Direct material specifications are used in Version 2.</div></div><Button variant="outline" className="rounded-none" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> Add Item</Button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-stone-50 border-b border-stone-200"><tr className="text-left">{["Room","Item Description","Material Specification","Unit","Qty/Area","Rate","Amount",""].map(h=><th key={h} className="px-3 py-3 label-uppercase">{h}</th>)}</tr></thead>
              <tbody>{record.rows.map(row=>{const amount=(Number(row.qty)||0)*(Number(row.rate)||0);return <tr key={row.id} className="border-b border-stone-100 align-top">
                <td className="px-3 py-3"><Input value={row.room} onChange={e=>updateRow(row.id,"room",e.target.value)} placeholder="Living Room" /></td>
                <td className="px-3 py-3"><Input value={row.description} onChange={e=>updateRow(row.id,"description",e.target.value)} placeholder="TV Unit / Kitchen / Wardrobe" /></td>
                <td className="px-3 py-3 min-w-[380px]"><Textarea value={row.specification} onChange={e=>updateRow(row.id,"specification",e.target.value)} placeholder="MR/BWR Plywood / Full Water Resistance • Laminate • Branded Stainless Steel Hardware..." rows={2} /></td>
                <td className="px-3 py-3"><Input value={row.unit} onChange={e=>updateRow(row.id,"unit",e.target.value)} /></td>
                <td className="px-3 py-3"><Input type="number" min="0" step="0.01" value={row.qty} onChange={e=>updateRow(row.id,"qty",e.target.value)} /></td>
                <td className="px-3 py-3"><Input type="number" min="0" step="0.01" value={row.rate} onChange={e=>updateRow(row.id,"rate",e.target.value)} /></td>
                <td className="px-3 py-3 font-semibold tabular-nums">{formatINR(amount)}</td>
                <td className="px-3 py-3"><Button variant="ghost" size="icon" className="rounded-none text-rose-600" onClick={()=>removeRow(row.id)} disabled={record.rows.length===1}><Trash2 className="w-4 h-4" /></Button></td>
              </tr>})}</tbody>
            </table></div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
            <div className="bg-white border border-stone-200 p-5"><div className="label-uppercase mb-3">Financial Settings</div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Discount Type"><select className="h-10 border border-stone-300 bg-white px-3 text-sm" value={record.financials.discountType} onChange={e=>setFinancial("discountType",e.target.value)}><option value="amount">Amount (₹)</option><option value="percent">Percentage (%)</option></select></Field>
              <Field label="Discount"><Input type="number" min="0" value={record.financials.discount} onChange={e=>setFinancial("discount",e.target.value)} /></Field>
              <Field label="GST"><div className="flex gap-2 items-center"><label className="flex items-center gap-2 h-10 px-3 border border-stone-300 text-sm"><input type="checkbox" checked={record.financials.gstEnabled} onChange={e=>setFinancial("gstEnabled",e.target.checked)} /> Add GST</label><Input className="w-24" type="number" value={record.financials.gstRate} onChange={e=>setFinancial("gstRate",e.target.value)} disabled={!record.financials.gstEnabled} /></div></Field>
            </div></div>
            <div className="bg-stone-900 text-white p-5"><div className="label-uppercase text-stone-400 mb-4">Estimate Summary</div><SummaryRow label="Subtotal" value={subtotal}/><SummaryRow label="Discount" value={-discount}/><SummaryRow label="Taxable Amount" value={taxable}/>{record.financials.gstEnabled && <SummaryRow label={"GST " + record.financials.gstRate + "%"} value={gst}/>}<div className="border-t border-stone-700 mt-4 pt-4 flex items-end justify-between"><span className="font-semibold">Grand Total</span><span className="text-2xl font-bold">{formatINR(grandTotal)}</span></div></div>
          </section>

          <div className="flex justify-end gap-2 pb-6"><Button variant="outline" className="rounded-none" onClick={()=>window.location.href="/estimates"}>Cancel</Button><Button className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> Save Version 2 Estimate</Button></div>
        </div>
      </PageBody>
    </div>
  );
}
function Field({label,children,className=""}){return <div className={className}><label className="label-uppercase block mb-1.5">{label}</label>{children}</div>;}
function SummaryRow({label,value}){return <div className="flex items-center justify-between text-sm py-1.5"><span className="text-stone-300">{label}</span><span className="tabular-nums">{formatINR(value)}</span></div>;}
function toLocalInput(value){const d=new Date(value||Date.now());if(Number.isNaN(d.getTime()))return "";const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}
