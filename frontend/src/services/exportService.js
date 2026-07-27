import { supabase } from "@/lib/supabase";

// Tables to include in the master ZIP export (safe subset — no auth / storage internals).
const EXPORT_TABLES = [
  "profiles",
  "leads",
  "lead_activities",
  "lead_assignees",
  "customers",
  "projects",
  "project_members",
  "estimates",
  "estimate_rooms",
  "estimate_items",
  "estimate_terms",
  "estimate_notes",
  "estimate_guides",
  "receipts",
  "receipt_attachments",
  "expenses",
  "vendors",
  "vendor_payments",
  "digital_approvals",
  "audit_log",
  "notifications",
];

const toCSV = (rows) => {
  if (!rows || rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
};

export const exportAllToZip = async (onProgress) => {
  // Dynamically import JSZip so the app bundle stays lean
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const readme = [
    `Sankalp Group — Full Data Backup`,
    `Generated: ${new Date().toString()}`,
    ``,
    `This ZIP contains one CSV per data table. It is machine-readable and can`,
    `be re-imported into any spreadsheet (Excel / Google Sheets) or database.`,
    ``,
    `Tables included:`,
    ...EXPORT_TABLES.map((t) => `  • ${t}.csv`),
    ``,
    `KEEP THIS BACKUP SAFE. Upload to your Google Drive / hard drive.`,
  ].join("\n");
  zip.file("README.txt", readme);

  let done = 0;
  const errors = [];
  for (const t of EXPORT_TABLES) {
    onProgress?.({ current: t, done, total: EXPORT_TABLES.length });
    try {
      // Paginate in chunks of 1000 to be safe on large tables
      let all = []; let from = 0; const step = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase.from(t).select("*").range(from, from + step - 1);
        if (error) { errors.push(`${t}: ${error.message}`); break; }
        all = all.concat(data || []);
        if (!data || data.length < step) break;
        from += step;
      }
      zip.file(`${t}.csv`, toCSV(all));
    } catch (e) { errors.push(`${t}: ${e.message || e}`); }
    done += 1;
    onProgress?.({ current: t, done, total: EXPORT_TABLES.length });
  }
  if (errors.length) zip.file("_errors.txt", errors.join("\n"));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `sankalp-backup-${timestamp}.zip`; a.click();
  URL.revokeObjectURL(url);
  return { errors, tables: EXPORT_TABLES.length };
};
