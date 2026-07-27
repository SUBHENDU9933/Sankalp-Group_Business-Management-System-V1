
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://tbfzxmbvzpszjldupycy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_lHpkefWymNBde8t8hESJ_A_8ENwAFBA';
const ADMIN_EMAIL = 'info.subhendu@gmail.com';
const ADMIN_PASSWORD = 'Subhendu8958@';

function rand() { return Math.random().toString(36).slice(2, 8); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const report = { steps: [] };
  function log(name, data) {
    report.steps.push({ name, ...data });
    console.log(`STEP ${name}: ${JSON.stringify(data)}`);
  }

  // Login as admin exactly as requested
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(!authError, `Admin login failed: ${authError && authError.message}`);
  const userId = auth.user.id;
  log('admin_login', { ok: true, userId });

  // Ensure a test customer exists so the approval title can include customer name.
  const customerName = `QA Watermark Customer ${rand()}`;
  const { data: customer, error: custError } = await supabase.from('customers').insert({
    name: customerName,
    phone: '9999999999',
    address: 'QA address',
    project_details: 'Watermark & map verification',
    created_by: userId,
  }).select('*').single();
  assert(!custError, `Customer create failed: ${custError && custError.message}`);
  log('customer_created', { id: customer.id, name: customer.name });

  // Create new approval and inspect generated token length.
  const subject = `Watermark & Map Test ${rand()}`;
  const { data: approval, error: approvalError } = await supabase.from('digital_approvals').insert({
    subject,
    description: 'QA verification for watermark, geotag, map, short token, and OG title.',
    customer_id: customer.id,
    customer_name: customer.name,
    photo_urls: [],
    file_urls: [],
    created_by: userId,
  }).select('*').single();
  assert(!approvalError, `Approval create failed: ${approvalError && approvalError.message}`);
  log('approval_created', { id: approval.id, token: approval.token, tokenLength: approval.token.length, subject, customerName });

  // Backward-compatible old long token simulation: update this test row to a 64-char token and fetch via public RPC.
  const longToken = 'qa' + Date.now().toString(16).padEnd(62, 'a').slice(0, 62);
  const { data: longRow, error: longUpdateError } = await supabase.from('digital_approvals')
    .update({ token: longToken })
    .eq('id', approval.id)
    .select('*').single();
  assert(!longUpdateError, `Long-token update failed: ${longUpdateError && longUpdateError.message}`);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: longFetch, error: longFetchError } = await anon.rpc('get_approval_by_token', { p_token: longToken });
  const fetchedLong = Array.isArray(longFetch) ? longFetch[0] : longFetch;
  assert(!longFetchError && fetchedLong && fetchedLong.id === approval.id, `Long token public fetch failed: ${longFetchError && longFetchError.message}`);
  log('long_token_backward_compat', { ok: true, tokenLength: longToken.length, fetchedId: fetchedLong.id });

  // Restore a unique fresh 12-char token for public browser flow. This preserves evidence that DB supports long tokens.
  const shortToken = `q${Date.now().toString(36).slice(-9)}${rand().slice(0,2)}`.slice(0, 12);
  const { data: flowApproval, error: restoreError } = await supabase.from('digital_approvals')
    .update({ token: shortToken })
    .eq('id', approval.id)
    .select('*').single();
  assert(!restoreError, `Short-token restore failed: ${restoreError && restoreError.message}`);
  log('short_token_for_flow', { token: flowApproval.token, tokenLength: flowApproval.token.length });

  // Confirm OG RPC exists and returns title data for crawler function.
  const { data: meta, error: metaError } = await anon.rpc('get_approval_meta_by_token', { p_token: shortToken });
  if (metaError) {
    log('og_rpc', { ok: false, error: metaError.message });
  } else {
    const row = Array.isArray(meta) ? meta[0] : meta;
    log('og_rpc', { ok: !!row, subject: row && row.subject, customer_name: row && row.customer_name, expectedTitle: `Approval Info : ${subject} (${customerName})` });
  }

  console.log('RESULT_JSON:' + JSON.stringify({ ok: true, approvalId: approval.id, customerId: customer.id, shortToken, longToken, subject, customerName, report }));
})().catch((err) => {
  console.error('RESULT_JSON:' + JSON.stringify({ ok: false, error: err.message, stack: err.stack }));
  process.exit(1);
});
