
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://tbfzxmbvzpszjldupycy.supabase.co', 'sb_publishable_lHpkefWymNBde8t8hESJ_A_8ENwAFBA', { auth: { persistSession: false } });
(async()=>{
  const { error: authError } = await supabase.auth.signInWithPassword({ email: 'info.subhendu@gmail.com', password: 'Subhendu8958@' });
  if (authError) throw authError;
  const token = 'qa21wmmap123';
  const { data, error } = await supabase.from('digital_approvals').update({ token }).eq('id','42a5a757-81dc-4745-81df-da34171fa6eb').select('id,token,status,subject,customer_name').single();
  if (error) throw error;
  console.log(JSON.stringify({ ok:true, data, tokenLength: data.token.length }));
})();
