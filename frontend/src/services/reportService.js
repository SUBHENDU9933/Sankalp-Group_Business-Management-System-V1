import { supabase } from "@/lib/supabase";

// Everything the Reports page needs, computed from the same underlying
// tables the Dashboard already uses (receipts, expenses, projects, leads) —
// just sliced differently: by project, by RM, by lead source, and by age.
export const fetchReportsData = async () => {
  const [projectsRes, receiptsRes, expensesRes, leadsRes, profilesRes] = await Promise.all([
    supabase.from("projects").select("id, project_name, total_value, status, start_date, created_by, created_at, customer_id, customers(name)").is("deleted_at", null),
    supabase.from("receipts").select("id, amount, project_id, created_at").is("deleted_at", null),
    supabase.from("expenses").select("id, amount, project_id, created_at").is("deleted_at", null),
    supabase.from("leads").select("id, source, status, created_at").is("deleted_at", null),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (receiptsRes.error) throw receiptsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const projects = projectsRes.data || [];
  const receipts = receiptsRes.data || [];
  const expenses = expensesRes.data || [];
  const leads = leadsRes.data || [];
  const profiles = profilesRes.data || [];
  const profileName = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || p.email || "Unknown"]));

  // ---- Per-project rollup ----
  const receiptsByProject = {};
  receipts.forEach((r) => { if (r.project_id) receiptsByProject[r.project_id] = (receiptsByProject[r.project_id] || 0) + Number(r.amount || 0); });
  const expensesByProject = {};
  expenses.forEach((e) => { if (e.project_id) expensesByProject[e.project_id] = (expensesByProject[e.project_id] || 0) + Number(e.amount || 0); });

  const projectRows = projects.map((p) => {
    const collected = receiptsByProject[p.id] || 0;
    const spent = expensesByProject[p.id] || 0;
    const contractValue = Number(p.total_value || 0);
    return {
      id: p.id,
      name: p.project_name,
      customerName: p.customers?.name || "—",
      rmId: p.created_by,
      rmName: profileName[p.created_by] || "Unassigned",
      status: p.status,
      startDate: p.start_date,
      createdAt: p.created_at,
      contractValue,
      collected,
      spent,
      netPL: collected - spent,
      outstanding: Math.max(contractValue - collected, 0),
      pctCollected: contractValue > 0 ? Math.round((collected / contractValue) * 100) : null,
    };
  });

  // ---- Per-RM rollup ----
  const rmMap = {};
  projectRows.forEach((p) => {
    const key = p.rmId || "unassigned";
    if (!rmMap[key]) rmMap[key] = { rmId: key, rmName: p.rmName, projects: 0, contractValue: 0, collected: 0, spent: 0, netPL: 0 };
    rmMap[key].projects += 1;
    rmMap[key].contractValue += p.contractValue;
    rmMap[key].collected += p.collected;
    rmMap[key].spent += p.spent;
    rmMap[key].netPL += p.netPL;
  });
  const rmRows = Object.values(rmMap).sort((a, b) => b.netPL - a.netPL);

  // ---- Lead source conversion ----
  const sourceMap = {};
  leads.forEach((l) => {
    const key = l.source || "Unknown";
    if (!sourceMap[key]) sourceMap[key] = { source: key, total: 0, converted: 0, lost: 0 };
    sourceMap[key].total += 1;
    if (l.status === "converted") sourceMap[key].converted += 1;
    if (l.status === "lost") sourceMap[key].lost += 1;
  });
  const sourceRows = Object.values(sourceMap)
    .map((s) => ({ ...s, conversionRate: s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // ---- Aging receivables (outstanding balance, oldest project first) ----
  const receivables = projectRows
    .filter((p) => p.outstanding > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // ---- 12-month revenue vs expense trend ----
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), receipts: 0, expenses: 0 });
  }
  const monthIndex = Object.fromEntries(months.map((m, i) => [m.key, i]));
  receipts.forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key in monthIndex) months[monthIndex[key]].receipts += Number(r.amount || 0);
  });
  expenses.forEach((e) => {
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key in monthIndex) months[monthIndex[key]].expenses += Number(e.amount || 0);
  });

  return {
    projectRows: projectRows.sort((a, b) => b.contractValue - a.contractValue),
    rmRows,
    sourceRows,
    receivables,
    monthlyTrend: months,
    totals: {
      contractValue: projectRows.reduce((s, p) => s + p.contractValue, 0),
      collected: projectRows.reduce((s, p) => s + p.collected, 0),
      spent: projectRows.reduce((s, p) => s + p.spent, 0),
      outstanding: projectRows.reduce((s, p) => s + p.outstanding, 0),
    },
  };
};
