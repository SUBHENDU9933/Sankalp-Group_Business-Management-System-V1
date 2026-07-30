import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { ArrowLeft, Save, Eye, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCustomers } from "@/services/customerService";
import { fetchLeads } from "@/services/leadService";
import { fetchProjects } from "@/services/projectService";
import { fetchEstimates } from "@/services/estimateService";
import { fetchTemplates } from "@/services/agreementTemplateService";
import { fetchAgreementById, createAgreement, updateAgreement, buildMergeDataFromSources } from "@/services/agreementService";
import { formatINR, numberToWords } from "@/utils/format";

export default function AgreementEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [templateId, setTemplateId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [title, setTitle] = useState("Interior Work Agreement");
  const [mergeData, setMergeData] = useState({});
  const [enabledClauseIds, setEnabledClauseIds] = useState([]);
  const [paymentSchedule, setPaymentSchedule] = useState([]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const customerOptions = useMemo(() => customers.map((c) => ({ value: c.id, label: c.name, sublabel: c.phone })), [customers]);
  const leadOptions = useMemo(() => leads.map((l) => ({ value: l.id, label: l.name, sublabel: l.phone })), [leads]);
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: p.project_name, sublabel: p.location })), [projects]);
  const estimateOptions = useMemo(() => estimates.map((e) => ({ value: e.id, label: `${e.estimate_no} · ${e.customer_name || ""}`, sublabel: formatINR(e.final_amount) })), [estimates]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cust, lds, projs, ests, tmpls] = await Promise.all([
          fetchCustomers(), fetchLeads(), fetchProjects(), fetchEstimates(), fetchTemplates(),
        ]);
        setCustomers(cust); setLeads(lds); setProjects(projs); setEstimates(ests); setTemplates(tmpls);

        if (isEdit) {
          const ag = await fetchAgreementById(id);
          if (!ag) { toast.error("Agreement not found"); nav("/agreements"); return; }
          setTemplateId(ag.template_id || "");
          setCustomerId(ag.customer_id || "");
          setLeadId(ag.lead_id || "");
          setProjectId(ag.project_id || "");
          setEstimateId(ag.estimate_id || "");
          setTitle(ag.title || "Interior Work Agreement");
          setMergeData(ag.merge_data || {});
          setEnabledClauseIds(ag.enabled_clause_ids || []);
          setPaymentSchedule(ag.payment_schedule || []);
        } else {
          const def = tmpls.find((t) => t.is_default) || tmpls[0];
          if (def) {
            setTemplateId(def.id);
            setEnabledClauseIds((def.clauses || []).filter((c) => c.enabled_default).map((c) => c.id));
            setPaymentSchedule(def.payment_schedule || []);
          }
        }
      } catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const applyAutoFill = (patch) => setMergeData((prev) => ({ ...prev, ...patch }));

  const handlePickCustomer = (val) => {
    setCustomerId(val); setLeadId("");
    const c = customers.find((x) => x.id === val);
    if (c) applyAutoFill(buildMergeDataFromSources({ customer: c }));
  };
  const handlePickLead = (val) => {
    setLeadId(val); setCustomerId("");
    const l = leads.find((x) => x.id === val);
    if (l) applyAutoFill(buildMergeDataFromSources({ lead: l }));
  };
  const handlePickProject = (val) => {
    setProjectId(val);
    const p = projects.find((x) => x.id === val);
    if (p) applyAutoFill(buildMergeDataFromSources({ project: p }));
  };
  const handlePickEstimate = (val) => {
    setEstimateId(val);
    const e = estimates.find((x) => x.id === val);
    if (e) applyAutoFill(buildMergeDataFromSources({ estimate: e }));
  };

  const toggleClause = (clauseId) => {
    setEnabledClauseIds((prev) => prev.includes(clauseId) ? prev.filter((x) => x !== clauseId) : [...prev, clauseId]);
  };

  const updatePaymentRow = (i, field, value) => {
    setPaymentSchedule((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };
  const addPaymentRow = () => setPaymentSchedule((prev) => [...prev, { stage: "New Stage", percent: 0 }]);
  const removePaymentRow = (i) => setPaymentSchedule((prev) => prev.filter((_, idx) => idx !== i));
  const scheduleTotal = paymentSchedule.reduce((s, r) => s + (Number(r.percent) || 0), 0);

  const handleSave = async (goToPrint) => {
    if (!templateId) { toast.error("Pick a template first"); return; }
    if (!customerId && !leadId) { toast.error("Pick a customer or lead"); return; }
    setSaving(true);
    try {
      const c = customers.find((x) => x.id === customerId);
      const p = projects.find((x) => x.id === projectId);
      const e = estimates.find((x) => x.id === estimateId);
      const finalMergeData = { ...mergeData, contract_value_words: numberToWords(mergeData.contract_value) };
      const payload = {
        template_id: templateId,
        template_name: selectedTemplate?.name || "",
        customer_id: customerId || null,
        customer_name: c?.name || mergeData.client_name || "",
        lead_id: leadId || null,
        project_id: projectId || null,
        project_name: p?.project_name || "",
        estimate_id: estimateId || null,
        estimate_no: e?.estimate_no || mergeData.estimate_no || "",
        title,
        merge_data: finalMergeData,
        enabled_clause_ids: enabledClauseIds,
        payment_schedule: paymentSchedule,
      };
      let saved;
      if (isEdit) saved = await updateAgreement(id, payload);
      else saved = await createAgreement(payload, user.id);
      toast.success(isEdit ? "Agreement updated" : "Agreement saved as draft");
      nav(goToPrint ? `/agreements/${saved.id}/print` : "/agreements");
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-16 text-center text-slate-400">Loading…</div>;

  const field = (key, label, opts = {}) => (
    <div>
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        className="rounded-lg mt-1"
        value={mergeData[key] || ""}
        onChange={(e) => applyAutoFill({ [key]: e.target.value })}
        {...opts}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Agreement" : "New Agreement"}
        subtitle="Contracts & MoUs"
        actions={
          <>
            <Button variant="outline" className="rounded-lg" onClick={() => nav("/agreements")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            <Button variant="outline" className="rounded-lg" disabled={saving} onClick={() => handleSave(true)} data-testid="agreement-save-preview">
              <Eye className="w-4 h-4 mr-1.5" /> Save &amp; Preview
            </Button>
            <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" disabled={saving} onClick={() => handleSave(false)} data-testid="agreement-save-button">
              <Save className="w-4 h-4 mr-1.5" /> Save Draft
            </Button>
          </>
        }
      />
      <PageBody className="max-w-4xl">
        <div className="space-y-6">
          {/* Template */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="label-uppercase mb-3">Template</div>
            <Select value={templateId} onValueChange={(v) => {
              setTemplateId(v);
              const t = templates.find((x) => x.id === v);
              if (t) { setEnabledClauseIds((t.clauses || []).filter((c) => c.enabled_default).map((c) => c.id)); setPaymentSchedule(t.payment_schedule || []); }
            }}>
              <SelectTrigger className="rounded-lg" data-testid="agreement-template-select"><SelectValue placeholder="Choose a template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="mt-3">
              <Label className="text-xs text-slate-500">Agreement Title</Label>
              <Input className="rounded-lg mt-1" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="agreement-title-input" />
            </div>
          </div>

          {/* Linking */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="label-uppercase mb-3 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Fetch Details</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Customer</Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={customerOptions}
                    value={customerId}
                    onChange={handlePickCustomer}
                    placeholder="Select customer"
                    searchPlaceholder="Search customers…"
                    testId="agreement-customer-select"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">…or Lead (not yet converted)</Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={leadOptions}
                    value={leadId}
                    onChange={handlePickLead}
                    placeholder="Select lead"
                    searchPlaceholder="Search leads…"
                    testId="agreement-lead-select"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Project</Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={projectOptions}
                    value={projectId}
                    onChange={handlePickProject}
                    placeholder="Select project"
                    searchPlaceholder="Search projects…"
                    testId="agreement-project-select"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Estimate</Label>
                <div className="mt-1">
                  <SearchableSelect
                    options={estimateOptions}
                    value={estimateId}
                    onChange={handlePickEstimate}
                    placeholder="Select estimate"
                    searchPlaceholder="Search estimates…"
                    testId="agreement-estimate-select"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Picking any of these auto-fills the fields below — everything stays fully editable after.</p>
          </div>

          {/* Merge fields */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="label-uppercase mb-3">Agreement Details</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field("client_name", "Client Full Name")}
              {field("client_mobile", "Client Mobile")}
              {field("client_address", "Client Address")}
              {field("client_guardian", "S/o · D/o (optional)")}
              {field("project_type", "Project Type / Description")}
              {field("project_location", "Project Location")}
              {field("estimate_no", "Estimate No.")}
              {field("estimate_date", "Estimate Date")}
              <div>
                <Label className="text-xs text-slate-500">Execution Category</Label>
                <Select value={mergeData.category || "Standard"} onValueChange={(v) => applyAutoFill({ category: v })}>
                  <SelectTrigger className="rounded-lg mt-1" data-testid="agreement-category-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Ultra">Ultra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {field("contract_value", "Final Agreed Contract Value (₹)", { type: "number" })}
              {field("timeline_days", "Timeline (working days)")}
              {field("buffer_days", "Buffer Period (working days)")}
              {field("promotional_gift", "Promotional Gift (optional)")}
            </div>
            <div className="mt-4">
              <Label className="text-xs text-slate-500">Approved Scope Items (one per line)</Label>
              <Textarea rows={4} className="rounded-lg mt-1" value={mergeData.scope_items || ""} onChange={(e) => applyAutoFill({ scope_items: e.target.value })} data-testid="agreement-scope-textarea" />
            </div>
            {mergeData.contract_value ? (
              <p className="text-xs text-slate-400 mt-2">In words: {numberToWords(mergeData.contract_value)}</p>
            ) : null}
          </div>

          {/* Payment schedule */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label-uppercase">Payment Schedule</div>
              <span className={`text-xs font-semibold ${scheduleTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>{scheduleTotal}% total</span>
            </div>
            <div className="space-y-2">
              {paymentSchedule.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="rounded-lg flex-1" value={row.stage} onChange={(e) => updatePaymentRow(i, "stage", e.target.value)} />
                  <Input className="rounded-lg w-24" type="number" value={row.percent} onChange={(e) => updatePaymentRow(i, "percent", Number(e.target.value))} />
                  <span className="text-sm text-slate-400">%</span>
                  <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => removePaymentRow(i)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="rounded-lg mt-3" onClick={addPaymentRow}>
              <Plus className="w-4 h-4 mr-1" /> Add Stage
            </Button>
          </div>

          {/* Optional clauses */}
          {selectedTemplate && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="label-uppercase mb-3">Clauses</div>
              <div className="space-y-2">
                {(selectedTemplate.clauses || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((c) => (
                  <label key={c.id} className="flex items-start gap-3 py-1.5">
                    <Checkbox
                      checked={c.is_optional ? enabledClauseIds.includes(c.id) : true}
                      disabled={!c.is_optional}
                      onCheckedChange={() => toggleClause(c.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{c.title} {c.is_optional && <span className="text-[10px] uppercase tracking-widest text-amber-600 ml-1">Optional</span>}</div>
                      <div className="text-xs text-slate-400 line-clamp-1">{c.body}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
