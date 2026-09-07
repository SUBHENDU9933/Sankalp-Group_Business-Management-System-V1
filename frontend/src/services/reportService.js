import { supabase } from "@/lib/supabase";

// Reports are read-only. The database RPC applies the same Lead -> Customer ->
// Project hierarchy used by the rest of BMS before aggregating any data.
export const fetchReportsData = async () => {
  const { data, error } = await supabase.rpc("get_reports_data");
  if (error) throw error;

  const result = data || {};
  return {
    scope: result.scope || "self",
    role: result.role || "re",
    projectRows: result.projectRows || [],
    rmRows: result.rmRows || [],
    sourceRows: result.sourceRows || [],
    receivables: result.receivables || [],
    monthlyTrend: result.monthlyTrend || [],
    totals: {
      contractValue: Number(result.totals?.contractValue || 0),
      collected: Number(result.totals?.collected || 0),
      spent: Number(result.totals?.spent || 0),
      outstanding: Number(result.totals?.outstanding || 0),
    },
  };
};
