import { supabase } from "@/lib/supabase";

// Entities that support soft-delete. Order matters for the Trash page tabs.
export const TRASH_ENTITIES = [
  { key: "leads",           label: "Leads",            table: "leads",            labelField: "name",
    select: "*, deleted_profile:profiles!leads_deleted_by_fkey(id,full_name,email), assigned_profile:profiles!leads_assigned_to_fkey(id,full_name,email), creator:profiles!leads_created_by_fkey(id,full_name,email)", },
  { key: "customers",       label: "Customers",        table: "customers",        labelField: "name",
    select: "*, creator:profiles!customers_created_by_fkey(id,full_name,email)", },
  { key: "projects",        label: "Projects",         table: "projects",         labelField: "project_name",
    select: "*, customer:customers!projects_customer_id_fkey(id,name), creator:profiles!projects_created_by_fkey(id,full_name,email)", },
  { key: "vendors",          label: "Vendors",          table: "vendors",          labelField: "name",
    select: "*, creator:profiles!vendors_created_by_fkey(id,full_name,email)", },
  { key: "estimates",        label: "Estimates",        table: "estimates",        labelField: "estimate_no",
    select: "*, creator:profiles!estimates_created_by_fkey(id,full_name,email), lead:leads(id,name)", },
  { key: "receipts",         label: "Receipts",         table: "receipts",         labelField: "receipt_no",
    select: "*, creator:profiles!receipts_created_by_fkey(id,full_name,email), customer:customers(id,name)", },
  { key: "expenses",         label: "Expenses",         table: "expenses",         labelField: "note",
    select: "*, creator:profiles!expenses_created_by_fkey(id,full_name,email), project:projects(id,project_name)", },
  { key: "vendor_payments",  label: "Vendor Payments",  table: "vendor_payments",  labelField: "note",
    select: "*, vendor:vendors(id,name), project:projects(id,project_name), creator:profiles!vendor_payments_created_by_fkey(id,full_name,email)", },
  { key: "vendor_bills",     label: "Vendor Bills",     table: "vendor_bills",     labelField: "title",
    select: "*, vendor:vendors(id,name), project:projects(id,project_name), creator:profiles!vendor_bills_created_by_fkey(id,full_name,email)", },
  { key: "digital_approvals", label: "Digital Approvals", table: "digital_approvals", labelField: "subject",
    select: "*, creator:profiles!digital_approvals_created_by_fkey(id,full_name,email)", },
  { key: "agreements",        label: "Agreements",       table: "agreements",       labelField: "title",
    select: "*, creator:profiles!agreements_created_by_fkey(id,full_name,email), customer:customers!agreements_customer_id_fkey(id,name)", },
  { key: "project_documents", label: "Project Documents", table: "project_documents", labelField: "name",
    select: "*, uploader:profiles!project_documents_uploaded_by_fkey(id,full_name,email)", },
];

const requireAdmin = async (action) => {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin,role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const role = profile?.is_admin
    ? "admin"
    : String(profile?.role || "").trim().toLowerCase();
  if (role !== "admin") {
    throw new Error(`Only Admin can ${action} trash records.`);
  }
};

export const listTrash = async (entityKey) => {
  await requireAdmin("view");
  const ent = TRASH_ENTITIES.find((e) => e.key === entityKey);
  if (!ent) throw new Error("Unknown entity: " + entityKey);
  // Try rich select first; if any FK is missing on user's schema, fall back to *
  let q = supabase.from(ent.table).select(ent.select).not("deleted_at", "is", null).order("deleted_at", { ascending: false });
  let { data, error } = await q;
  if (error && /column|relationship|schema cache/i.test(error.message)) {
    const r = await supabase.from(ent.table).select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    if (r.error) throw r.error;
    data = r.data;
  } else if (error) {
    throw error;
  }
  return data || [];
};

export const restoreItem = async (entityKey, id) => {
  await requireAdmin("restore");
  const ent = TRASH_ENTITIES.find((e) => e.key === entityKey);
  if (!ent) throw new Error("Unknown entity: " + entityKey);
  const { data, error } = await supabase.from(ent.table)
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Restore denied — the row is not visible to you or RLS blocked the update.");
  }
};

export const restoreMany = async (entityKey, ids) => {
  await requireAdmin("restore");
  const ent = TRASH_ENTITIES.find((e) => e.key === entityKey);
  if (!ent) throw new Error("Unknown entity: " + entityKey);
  const { data, error } = await supabase.from(ent.table)
    .update({ deleted_at: null, deleted_by: null })
    .in("id", ids)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Bulk restore returned 0 rows — RLS blocked the update.");
  }
};

export const purgeItem = async (entityKey, id) => {
  await requireAdmin("permanently delete");
  const ent = TRASH_ENTITIES.find((e) => e.key === entityKey);
  if (!ent) throw new Error("Unknown entity: " + entityKey);
  const { data, error } = await supabase.from(ent.table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Purge returned 0 rows — RLS DELETE policy missing.");
  }
};

export const purgeMany = async (entityKey, ids) => {
  await requireAdmin("permanently delete");
  const ent = TRASH_ENTITIES.find((e) => e.key === entityKey);
  if (!ent) throw new Error("Unknown entity: " + entityKey);
  const { data, error } = await supabase.from(ent.table)
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Bulk purge returned 0 rows — RLS DELETE policy missing.");
  }
};
