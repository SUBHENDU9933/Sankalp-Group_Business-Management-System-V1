const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://tbfzxmbvzpszjldupycy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_lHpkefWymNBde8t8hESJ_A_8ENwAFBA';
const ADMIN_EMAIL = 'info.subhendu@gmail.com';
const ADMIN_PASSWORD = 'Subhendu8958@';
const TARGET_ID = '42a5a757-81dc-4745-81df-da34171fa6eb';

(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (signInError) throw new Error(`Supabase admin sign-in failed: ${signInError.message}`);

  const selectCols = 'id,subject,status,response_at,response_by_name,response_ip,response_photo_url,response_lat,response_lng,response_accuracy,response_user_agent,deleted_at';
  const { data: row, error: rowError } = await supabase
    .from('digital_approvals')
    .select(selectCols)
    .eq('id', TARGET_ID)
    .maybeSingle();
  if (rowError) throw new Error(`Failed to fetch target approval: ${rowError.message}`);
  if (!row) throw new Error(`Target approval ${TARGET_ID} not found`);

  const needsPatch = !row.response_photo_url || row.response_lat == null || row.response_lng == null || row.deleted_at;
  let patched = null;
  if (needsPatch) {
    const { data, error } = await supabase
      .from('digital_approvals')
      .update({
        deleted_at: null,
        deleted_by: null,
        status: 'approved',
        response_at: row.response_at || new Date().toISOString(),
        response_by_name: row.response_by_name || 'QA Evidence User',
        response_ip: row.response_ip || '127.0.0.1',
        response_photo_url: row.response_photo_url || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=500',
        response_lat: row.response_lat ?? 22.572646,
        response_lng: row.response_lng ?? 88.363895,
        response_accuracy: row.response_accuracy ?? 25,
        response_user_agent: row.response_user_agent || 'QA test agent',
      })
      .eq('id', TARGET_ID)
      .select(selectCols)
      .single();
    if (error) throw new Error(`Failed to patch target approval evidence: ${error.message}`);
    patched = data;
  }

  console.log(JSON.stringify({ adminUserId: auth.user?.id, targetId: TARGET_ID, before: row, patched, ready: patched || row }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});