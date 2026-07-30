import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, FileText, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchTemplates, createTemplate, updateTemplate, softDeleteTemplate, emptyClause,
} from "@/services/agreementTemplateService";

export default function AgreementTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view

  const load = async () => {
    setLoading(true);
    try { setTemplates(await fetchTemplates()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setEditing({
    name: "New Agreement Template",
    description: "",
    is_default: templates.length === 0,
    clauses: [{ ...emptyClause(), sort_order: 1 }],
    payment_schedule: [{ stage: "Advance", percent: 100 }],
    category_specs: { standard: [], premium: [], ultra: [] },
  });

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try { await softDeleteTemplate(t.id, user.id); toast.success("Template removed"); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (editing) {
    return <TemplateEditor
      template={editing}
      onCancel={() => setEditing(null)}
      onSaved={() => { setEditing(null); load(); }}
    />;
  }

  return (
    <>
      <PageHeader
        title="Agreement Templates"
        subtitle="Contracts & MoUs · Admin"
        actions={
          <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={openNew} data-testid="template-new-button">
            <Plus className="w-4 h-4 mr-1.5" /> New Template
          </Button>
        }
      />
      <PageBody>
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-2xl">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <div className="text-slate-500">No templates yet.</div>
          </div>
        ) : (
          <div className="grid gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4" data-testid={`template-row-${t.id}`}>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    {t.name} {t.is_default && <span className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 rounded">Default</span>}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{t.description || "—"}</div>
                  <div className="text-xs text-slate-400 mt-1">{(t.clauses || []).length} clauses · {(t.payment_schedule || []).length} payment stages</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditing(t)}>Edit</Button>
                  <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function TemplateEditor({ template, onCancel, onSaved }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [isDefault, setIsDefault] = useState(template.is_default);
  const [clauses, setClauses] = useState(template.clauses || []);
  const [schedule, setSchedule] = useState(template.payment_schedule || []);
  const [specs, setSpecs] = useState(template.category_specs || { standard: [], premium: [], ultra: [] });

  const updateClause = (i, field, value) => setClauses((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  const addClause = () => setClauses((prev) => [...prev, { ...emptyClause(), sort_order: prev.length + 1 }]);
  const removeClause = (i) => setClauses((prev) => prev.filter((_, idx) => idx !== i));
  const moveClause = (i, dir) => setClauses((prev) => {
    const arr = [...prev];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return prev;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
  });

  const updateScheduleRow = (i, field, value) => setSchedule((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addScheduleRow = () => setSchedule((prev) => [...prev, { stage: "New Stage", percent: 0 }]);
  const removeScheduleRow = (i) => setSchedule((prev) => prev.filter((_, idx) => idx !== i));

  const updateSpecLines = (key, text) => setSpecs((prev) => ({ ...prev, [key]: text.split("\n").map((l) => l.trim()).filter(Boolean) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { name, description, is_default: isDefault, clauses, payment_schedule: schedule, category_specs: specs };
      if (template.id) await updateTemplate(template.id, payload);
      else await createTemplate(payload, user.id);
      toast.success("Template saved");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        title={template.id ? "Edit Template" : "New Template"}
        subtitle="Contracts & MoUs · Admin"
        actions={
          <>
            <Button variant="outline" className="rounded-lg" onClick={onCancel}><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Button>
            <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" disabled={saving} onClick={handleSave} data-testid="template-save-button">
              <Save className="w-4 h-4 mr-1.5" /> Save Template
            </Button>
          </>
        }
      />
      <PageBody className="max-w-4xl space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Template Info</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Name</Label>
              <Input className="rounded-lg mt-1" value={name} onChange={(e) => setName(e.target.value)} data-testid="template-name-input" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Description</Label>
              <Input className="rounded-lg mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
            <span className="text-sm text-slate-700">Use as default template for new agreements</span>
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Clauses</div>
          <div className="space-y-4">
            {clauses.map((c, i) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Input className="rounded-lg flex-1 font-medium" value={c.title} onChange={(e) => updateClause(i, "title", e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => moveClause(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => moveClause(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => removeClause(i)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <Textarea rows={3} className="rounded-lg" value={c.body} onChange={(e) => updateClause(i, "body", e.target.value)} placeholder="Use {{placeholders}} — e.g. {{client_name}}, {{estimate_no}}, {{payment_schedule_table}}, {{category_specs_table}}" />
                <label className="flex items-center gap-2 mt-2">
                  <Checkbox checked={c.is_optional} onCheckedChange={(v) => updateClause(i, "is_optional", !!v)} />
                  <span className="text-xs text-slate-600">Optional clause (can be toggled per agreement)</span>
                  {c.is_optional && (
                    <label className="flex items-center gap-1.5 ml-4">
                      <Checkbox checked={c.enabled_default} onCheckedChange={(v) => updateClause(i, "enabled_default", !!v)} />
                      <span className="text-xs text-slate-600">On by default</span>
                    </label>
                  )}
                </label>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="rounded-lg mt-3" onClick={addClause}>
            <Plus className="w-4 h-4 mr-1" /> Add Clause
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Default Payment Schedule</div>
          <div className="space-y-2">
            {schedule.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="rounded-lg flex-1" value={row.stage} onChange={(e) => updateScheduleRow(i, "stage", e.target.value)} />
                <Input className="rounded-lg w-24" type="number" value={row.percent} onChange={(e) => updateScheduleRow(i, "percent", Number(e.target.value))} />
                <span className="text-sm text-slate-400">%</span>
                <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => removeScheduleRow(i)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="rounded-lg mt-3" onClick={addScheduleRow}>
            <Plus className="w-4 h-4 mr-1" /> Add Stage
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Category Specifications (one line per item)</div>
          <div className="grid sm:grid-cols-3 gap-4">
            {["standard", "premium", "ultra"].map((key) => (
              <div key={key}>
                <Label className="text-xs text-slate-500 capitalize">{key}</Label>
                <Textarea rows={6} className="rounded-lg mt-1" value={(specs[key] || []).join("\n")} onChange={(e) => updateSpecLines(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}
