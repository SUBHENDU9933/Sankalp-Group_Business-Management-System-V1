import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { downloadLeadTemplate, parseLeadsFile, parseLeadRow } from "@/utils/leadCsv";
import { bulkInsertLeads } from "@/services/leadService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LeadImportDialog({ open, onOpenChange, rmOptions = [], onImported }) {
  const { user, isAdmin } = useAuth();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);          // parsed raw rows
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [assignTo, setAssignTo] = useState("self");
  const [result, setResult] = useState(null);

  const reset = () => { setFile(null); setRows([]); setResult(null); setAssignTo("self"); if (fileRef.current) fileRef.current.value = ""; };

  const close = (v) => { if (!v) reset(); onOpenChange(v); };

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    try {
      const data = await parseLeadsFile(f);
      setRows(data);
    } catch (err) {
      toast.error("Could not parse file. Please use the template format.");
    } finally { setParsing(false); }
  };

  const previewRows = rows.slice(0, 8);
  const validCount = rows.filter((r) => (r.name || "").trim() || (r.phone || "").trim()).length;
  const skippedCount = rows.length - validCount;

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const defaults = { assignedTo: assignTo === "self" ? user.id : assignTo === "unassigned" ? null : assignTo };
      const cleaned = rows.map((r) => parseLeadRow(r, defaults)).filter(Boolean);
      const res = await bulkInsertLeads(cleaned, user.id);
      setResult(res);
      toast.success(`Imported ${res.inserted} leads · ${res.skipped} skipped`);
      onImported?.();
    } catch (e) { toast.error(e.message); }
    finally { setImporting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-none border-stone-300 max-w-3xl p-0 max-h-[92vh] overflow-y-auto" data-testid="lead-import-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">Bulk Import</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Import leads from CSV</DialogTitle>
          <DialogDescription className="text-xs text-stone-500 mt-1">
            Upload a .csv file. Use the template below for the correct column format. Excel (.xlsx) — open it &amp; "Save As CSV".
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Step 1 — Template */}
          <div className="bg-stone-50 border border-stone-200 p-4 flex items-start gap-3">
            <div className="w-10 h-10 grid place-items-center bg-blue-100 text-blue-700 font-bold">1</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-900">Download the template</div>
              <p className="text-xs text-stone-600 mt-1">Includes one example row + all supported columns. Required: <span className="font-mono">name</span> or <span className="font-mono">phone</span>. Status defaults to <span className="font-mono">new</span>.</p>
            </div>
            <Button onClick={downloadLeadTemplate} variant="outline" className="rounded-none border-stone-300 hover:bg-stone-100" data-testid="import-download-template">
              <Download className="w-4 h-4 mr-1.5" />Template
            </Button>
          </div>

          {/* Step 2 — File picker */}
          <div className="bg-stone-50 border border-stone-200 p-4 flex items-start gap-3">
            <div className="w-10 h-10 grid place-items-center bg-blue-100 text-blue-700 font-bold">2</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-900">Choose your file</div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPick} className="hidden" data-testid="import-file-input" />
              <Button onClick={() => fileRef.current?.click()} disabled={parsing || importing} className="mt-2 rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="import-pick-file">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />{file ? file.name : parsing ? "Parsing…" : "Select CSV file"}
              </Button>
              {rows.length > 0 && (
                <div className="text-xs text-stone-700 mt-2 inline-flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span><span className="font-bold">{validCount}</span> valid row{validCount !== 1 ? "s" : ""}</span>
                  {skippedCount > 0 && <span className="text-rose-600">· {skippedCount} empty</span>}
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — Defaults */}
          {rows.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 p-4 flex items-start gap-3">
              <div className="w-10 h-10 grid place-items-center bg-blue-100 text-blue-700 font-bold">3</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-stone-900">Default assignee</div>
                <p className="text-xs text-stone-600 mt-1">All imported leads will be assigned to this person.</p>
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger className="rounded-none mt-2 border-stone-300 max-w-xs" data-testid="import-assign-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="self" className="rounded-none">Me ({user?.email})</SelectItem>
                    <SelectItem value="unassigned" className="rounded-none">Unassigned</SelectItem>
                    {isAdmin && rmOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="rounded-none">
                        {p.full_name || p.email} <span className="text-stone-500 ml-1">({p.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && !result && (
            <div>
              <Label className="label-uppercase">Preview · first {previewRows.length} of {rows.length}</Label>
              <div className="border border-stone-200 mt-2 overflow-x-auto bg-white">
                <table className="w-full text-xs" data-testid="import-preview">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="text-left">
                      <th className="px-3 py-2 label-uppercase">Name</th>
                      <th className="px-3 py-2 label-uppercase">Phone</th>
                      <th className="px-3 py-2 label-uppercase">Location</th>
                      <th className="px-3 py-2 label-uppercase">Project</th>
                      <th className="px-3 py-2 label-uppercase">Source</th>
                      <th className="px-3 py-2 label-uppercase">Priority</th>
                      <th className="px-3 py-2 label-uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="grid-divider-y">
                    {previewRows.map((r, i) => {
                      const c = parseLeadRow(r, {});
                      const empty = !c;
                      return (
                        <tr key={i} className={cn(empty && "opacity-40")}>
                          <td className="px-3 py-2">{c?.name || <span className="text-rose-600">(empty)</span>}</td>
                          <td className="px-3 py-2 font-mono">{c?.phone || "—"}</td>
                          <td className="px-3 py-2">{[c?.area, c?.location].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-3 py-2">{c?.project_type || "—"}</td>
                          <td className="px-3 py-2">{c?.source || "—"}</td>
                          <td className="px-3 py-2 capitalize">{c?.priority || "—"}</td>
                          <td className="px-3 py-2 capitalize">{(c?.status || "").replace(/_/g, " ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="border border-emerald-300 bg-emerald-50 p-4" data-testid="import-result">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <div className="font-display text-lg font-bold text-emerald-800">Import complete</div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                <div><div className="label-uppercase">Inserted</div><div className="font-display text-2xl font-bold text-emerald-800 tabular-nums">{result.inserted}</div></div>
                <div><div className="label-uppercase">Skipped (dup phone)</div><div className="font-display text-2xl font-bold text-stone-700 tabular-nums">{result.skipped}</div></div>
                <div><div className="label-uppercase">Errors</div><div className="font-display text-2xl font-bold text-rose-700 tabular-nums">{result.errors.length}</div></div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 border-t border-emerald-200 pt-3">
                  <div className="text-xs font-bold text-rose-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Some rows failed:</div>
                  <ul className="text-xs text-stone-700 mt-1 list-disc pl-5 space-y-0.5">
                    {result.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-between items-center">
          <div className="text-[10px] tracking-widest uppercase text-stone-500">Duplicates by phone are skipped automatically.</div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => close(false)}>{result ? "Close" : "Cancel"}</Button>
            {!result && (
              <Button type="button" disabled={!rows.length || importing} onClick={handleImport} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="import-confirm-btn">
                <Upload className="w-4 h-4 mr-1.5" />{importing ? "Importing…" : `Import ${validCount} leads`}<ArrowRight className="w-3 h-3 ml-1.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
