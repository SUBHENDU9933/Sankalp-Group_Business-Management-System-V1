const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const APP_URL = process.env.APP_URL || 'https://lead-conversion-14.preview.emergentagent.com';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://tbfzxmbvzpszjldupycy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_lHpkefWymNBde8t8hESJ_A_8ENwAFBA';
const ADMIN_EMAIL = 'info.subhendu@gmail.com';
const ADMIN_PASSWORD = 'Subhendu8958@';
const TARGET_ID = '42a5a757-81dc-4745-81df-da34171fa6eb';

(async () => {
  const result = {
    appUrl: APP_URL,
    targetId: TARGET_ID,
    db: {},
    ui: {},
    errors: [],
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (signInError) throw new Error(`Supabase admin sign-in failed: ${signInError.message}`);
  result.db.adminUserId = auth.user?.id;

  const { data: row, error: rowError } = await supabase
    .from('digital_approvals')
    .select('id,subject,status,response_at,response_photo_url,response_lat,response_lng,deleted_at')
    .eq('id', TARGET_ID)
    .maybeSingle();
  if (rowError) throw new Error(`Failed to fetch target approval: ${rowError.message}`);
  result.db.targetBefore = row;

  const needsPatch = !row || !row.response_photo_url || row.response_lat == null || row.response_lng == null || row.deleted_at;
  if (needsPatch) {
    const patchPayload = {
      deleted_at: null,
      deleted_by: null,
      status: 'approved',
      response_at: row?.response_at || new Date().toISOString(),
      response_by_name: row?.response_by_name || 'QA Evidence User',
      response_ip: row?.response_ip || '127.0.0.1',
      response_photo_url: row?.response_photo_url || 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=500',
      response_lat: row?.response_lat ?? 22.572646,
      response_lng: row?.response_lng ?? 88.363895,
      response_accuracy: 25,
      response_user_agent: row?.response_user_agent || 'QA test agent',
    };
    const { data: patched, error: patchError } = await supabase
      .from('digital_approvals')
      .update(patchPayload)
      .eq('id', TARGET_ID)
      .select('id,subject,status,response_at,response_photo_url,response_lat,response_lng,deleted_at')
      .single();
    if (patchError) throw new Error(`Failed to patch target approval evidence: ${patchError.message}`);
    result.db.patchedTarget = patched;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.new_context({ viewport: { width: 1920, height: 1080 } });
  const page = await context.new_page();
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) result.errors.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => result.errors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(`${APP_URL}/login`, { wait_until: 'domcontentloaded', timeout: 60000 });
    await page.get_by_test_id('login-email-input').fill(ADMIN_EMAIL);
    await page.get_by_test_id('login-password-input').fill(ADMIN_PASSWORD);
    await page.get_by_test_id('login-submit-button').click();
    await page.wait_for_url(/\/$/, { timeout: 30000 }).catch(() => {});

    await page.goto(`${APP_URL}/digital-approvals`, { wait_until: 'domcontentloaded', timeout: 60000 });
    await page.get_by_test_id('da-search').fill('Watermark & Map Test ogmf86');
    await page.wait_for_timeout(1500);

    const card = page.get_by_test_id(`da-card-${TARGET_ID}`);
    await card.wait_for({ state: 'visible', timeout: 30000 });
    await card.click();

    const sheet = page.get_by_test_id('da-detail-sheet');
    await sheet.wait_for({ state: 'visible', timeout: 10000 });
    const selfie = page.get_by_test_id('da-detail-selfie');
    const map = page.get_by_test_id('da-detail-map');
    await selfie.wait_for({ state: 'visible', timeout: 10000 });
    await map.wait_for({ state: 'visible', timeout: 10000 });
    await page.wait_for_timeout(2500);

    result.ui.sheetVisible = await sheet.is_visible();
    result.ui.selfieVisible = await selfie.is_visible();
    result.ui.mapVisible = await map.is_visible();
    result.ui.mapHref = await map.get_attribute('href');
    result.ui.selfieHref = await selfie.get_attribute('href');
    result.ui.evidenceTitleVisible = await page.get_by_text('Customer Selfie & Location', { exact: true }).is_visible();

    result.ui.layout = await page.evaluate(() => {
      const selfieEl = document.querySelector('[data-testid="da-detail-selfie"]');
      const mapEl = document.querySelector('[data-testid="da-detail-map"]');
      if (!selfieEl || !mapEl) return null;
      const parent = selfieEl.parentElement;
      const parentStyle = window.getComputedStyle(parent);
      const selfieRect = selfieEl.getBoundingClientRect();
      const mapRect = mapEl.getBoundingClientRect();
      const mapImg = mapEl.querySelector('img');
      return {
        sameParent: parent === mapEl.parentElement,
        parentClass: parent.className,
        display: parentStyle.display,
        gridTemplateColumns: parentStyle.gridTemplateColumns,
        childCount: parent.children.length,
        selfieRect: { x: selfieRect.x, y: selfieRect.y, width: selfieRect.width, height: selfieRect.height },
        mapRect: { x: mapRect.x, y: mapRect.y, width: mapRect.width, height: mapRect.height },
        sideBySide: Math.abs(selfieRect.y - mapRect.y) < 20 && mapRect.x > selfieRect.x + selfieRect.width * 0.7,
        fallbackText: mapEl.textContent || '',
        mapImagePresent: !!mapImg,
        mapImageDisplay: mapImg ? window.getComputedStyle(mapImg).display : null,
      };
    });

    const popupPromise = page.wait_for_event('popup', { timeout: 10000 });
    await map.click({ force: true });
    const popup = await popupPromise;
    await popup.wait_for_load_state('domcontentloaded', { timeout: 15000 }).catch(() => {});
    result.ui.popupUrl = popup.url();
    await popup.close().catch(() => {});

    result.ui.pass = !!(
      result.ui.sheetVisible &&
      result.ui.selfieVisible &&
      result.ui.mapVisible &&
      result.ui.layout?.sameParent &&
      result.ui.layout?.display === 'grid' &&
      result.ui.layout?.sideBySide &&
      result.ui.mapHref?.startsWith('https://maps.google.com/?q=') &&
      result.ui.popupUrl?.startsWith('https://maps.google.com/')
    );
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ui.pass) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});