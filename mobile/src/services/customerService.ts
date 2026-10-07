import { supabase } from '../lib/supabase';

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  project_details?: string | null;
  status?: string | null;
  created_at?: string | null;
  assigned_to?: string | null;
};

const CUSTOMER_SELECT = `*, creator:profiles!customers_created_by_fkey(id,full_name,email,role), assigned_profile:profiles!customers_assigned_to_fkey(id,full_name,email,role), assignees:customer_assignees(user_id,assigned_by,added_at,profile:customer_assignees_user_id_fkey(id,full_name,email,role))`;

export async function fetchCustomers() {
  let result = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (result.error && /deleted_at/i.test(result.error.message)) {
    result = await supabase
      .from('customers')
      .select(CUSTOMER_SELECT)
      .order('created_at', { ascending: false });
  }
  if (result.error) throw result.error;
  return (result.data || []) as Customer[];
}

export async function fetchCustomerById(id: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

export async function fetchCustomerCount() {
  const { count, error } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (error) throw error;
  return count || 0;
}
