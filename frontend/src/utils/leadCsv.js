import { LEAD_STATUSES, LEAD_PRIORITIES, LEAD_SOURCES, PROJECT_TYPES, PROPERTY_TYPES } from "@/utils/format";
import { downloadBlob, toCSV, parseCSV } from "@/utils/csv";

/* CSV column schema — used for both export and template download */
export const LEAD_CSV_COLUMNS = [
  { key: "name", header: "name" },
  { key: "phone", header: "phone" },
  { key: "phone_secondary", header: "phone_secondary" },
  { key: "location", header: "location" },
  { key: "area", header: "area" },
  { key: "pincode", header: "pincode" },
  { key: "project_type", header: "project_type" },
  { key: "property_type", header: "property_type" },
  { key: "area_sqft", header: "area_sqft" },
  { key: "budget", header: "budget" },
  { key: "requirement", header: "requirement" },
  { key: "source", header: "source" },
  { key: "priority", header: "priority" },
  { key: "status", header: "status" },
  { key: "next_followup_date", header: "next_followup_date" },
  { key: "last_contact_date", header: "last_contact_date" },
  { key: "reminder_note", header: "reminder_note" },
  // Read-only export columns:
  { key: "_assigned_rm", header: "assigned_rm", format: (r) => r.assigned_profile?.full_name || r.assigned_profile?.email || "" },
  { key: "_creator", header: "created_by", format: (r) => r.creator?.full_name || r.creator?.email || "" },
  { key: "created_at", header: "created_at", format: (r) => (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "") },
];

const VALID_STATUSES = new Set(LEAD_STATUSES.map((s) => s.key));
const VALID_PRIORITIES = new Set(LEAD_PRIORITIES.map((p) => p.key));
const VALID_SOURCES = new Set(LEAD_SOURCES.map((s) => s.toLowerCase()));
const VALID_PROJECT = new Set(PROJECT_TYPES.map((s) => s.toLowerCase()));
const VALID_PROPERTY = new Set(PROPERTY_TYPES.map((s) => s.toLowerCase()));

const normaliseDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  // Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  }
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) {
    return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  }
  return null; // ignore invalid dates
};

const matchInsensitive = (raw, allowed) => {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  return allowed.has(s) ? s : null;
};

/**
 * Convert a parsed CSV row into a clean lead payload.
 * Defaults: assigned_to = currentUserId, status = "new" (if invalid).
 */
export const parseLeadRow = (row, defaults = {}) => {
  const name = (row.name || "").trim();
  const phone = (row.phone || "").trim();
  if (!name && !phone) return null; // empty row

  const cleaned = {
    name: name || "(Unnamed)",
    phone: phone || null,
    phone_secondary: (row.phone_secondary || "").trim() || null,
    location: (row.location || "").trim() || null,
    area: (row.area || "").trim() || null,
    pincode: (row.pincode || "").trim() || null,
    project_type: (() => {
      const m = matchInsensitive(row.project_type, VALID_PROJECT);
      if (!m) return (row.project_type || "").trim() || null;
      return PROJECT_TYPES.find((p) => p.toLowerCase() === m) || null;
    })(),
    property_type: (() => {
      const m = matchInsensitive(row.property_type, VALID_PROPERTY);
      if (!m) return (row.property_type || "").trim() || null;
      return PROPERTY_TYPES.find((p) => p.toLowerCase() === m) || null;
    })(),
    area_sqft: row.area_sqft ? Number(row.area_sqft) || null : null,
    budget: row.budget ? Number(row.budget) || null : null,
    requirement: (row.requirement || "").trim() || null,
    source: (() => {
      const m = matchInsensitive(row.source, VALID_SOURCES);
      if (!m) return (row.source || "").trim() || null;
      return LEAD_SOURCES.find((s) => s.toLowerCase() === m) || null;
    })(),
    priority: VALID_PRIORITIES.has((row.priority || "").trim().toLowerCase()) ? (row.priority || "").trim().toLowerCase() : null,
    status: VALID_STATUSES.has((row.status || "").trim().toLowerCase()) ? (row.status || "").trim().toLowerCase() : "new",
    next_followup_date: normaliseDate(row.next_followup_date),
    last_contact_date: normaliseDate(row.last_contact_date),
    reminder_note: (row.reminder_note || "").trim() || null,
    assigned_to: defaults.assignedTo || null,
  };
  return cleaned;
};

/**
 * Export an array of leads to CSV and trigger download.
 */
export const exportLeadsCSV = (leads, filename = `leads-${new Date().toISOString().slice(0,10)}.csv`) => {
  const csv = toCSV(leads, LEAD_CSV_COLUMNS);
  downloadBlob(filename, csv);
};

/**
 * Download a sample CSV with one demo row + header to use as an import template.
 */
export const downloadLeadTemplate = () => {
  const sample = [{
    name: "Demo Customer",
    phone: "9876543210",
    phone_secondary: "",
    location: "Kolkata",
    area: "Salt Lake",
    pincode: "700091",
    project_type: "3BHK",
    property_type: "Apartment",
    area_sqft: "1200",
    budget: "1500000",
    requirement: "Modular kitchen + 2 wardrobes + false ceiling",
    source: "Facebook",
    priority: "hot",
    status: "new",
    next_followup_date: "2026-05-15",
    last_contact_date: "",
    reminder_note: "Site visit scheduled at 4pm",
  }];
  const csv = toCSV(sample, LEAD_CSV_COLUMNS.filter((c) => !c.key.startsWith("_") && c.key !== "created_at"));
  downloadBlob("sankalp-leads-import-template.csv", csv);
};

export const parseLeadsFile = parseCSV;
