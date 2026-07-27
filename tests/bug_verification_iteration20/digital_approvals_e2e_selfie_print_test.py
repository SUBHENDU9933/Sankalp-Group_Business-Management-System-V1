# Focused Playwright QA script for Iteration 20 Digital Approvals bug verification.
# This script is stored as a test artifact and executed through the MCP browser automation runner.

import re

try:
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.set_default_timeout(30000)
    context = page.context
    base = "https://lead-conversion-14.preview.emergentagent.com"
    subject = "E2E Test Approval v2 Iter20"
    customer_name = "Test Customer Iter20"

    print("STEP 0: Configure fake front camera, geolocation, and print interception")
    page.on("dialog", lambda dialog: print(f"Dialog shown: {dialog.message}"))
    try:
        await context.grant_permissions(["camera", "geolocation"], origin=base)
    except Exception as perm_e:
        print(f"Permission grant warning: {perm_e}")
    await context.add_init_script("""
      (() => {
        window.__printCalled = false;
        window.print = () => { window.__printCalled = true; console.log('window.print intercepted'); };
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#065f46'; ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#ffffff'; ctx.font = '42px sans-serif';
          ctx.fillText('FAKE FRONT CAMERA', 95, 230);
          ctx.font = '22px sans-serif'; ctx.fillText(new Date().toISOString(), 135, 280);
          return canvas.captureStream(15);
        };
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (success, error, opts) => success({coords: {latitude: 22.5726, longitude: 88.3639, accuracy: 8}}),
            watchPosition: (success, error, opts) => { success({coords: {latitude: 22.5726, longitude: 88.3639, accuracy: 8}}); return 1; },
            clearWatch: () => {}
          }
        });
      })();
    """)

    print("STEP 1: Log in as admin and open Digital Approvals")
    await page.goto(f"{base}/login", wait_until="domcontentloaded")
    await page.wait_for_timeout(1000)
    if await page.get_by_test_id("login-email-input").count() > 0:
        await page.get_by_test_id("login-email-input").fill("info.subhendu@gmail.com")
        await page.get_by_test_id("login-password-input").fill("Subhendu8958@")
        await page.get_by_test_id("login-submit-button").click()
        await page.wait_for_timeout(5000)
        print(f"After login URL: {page.url}")
    else:
        print("Login form not shown; using existing session")

    await page.goto(f"{base}/digital-approvals", wait_until="domcontentloaded")
    await page.get_by_test_id("digital-approvals-page").wait_for(state="visible", timeout=30000)
    print("PASS: Digital Approvals page visible")

    print("STEP 2: Create a new approval and copy public token/link")
    await page.get_by_test_id("new-approval-btn").click()
    await page.get_by_test_id("da-subject").wait_for(state="visible", timeout=15000)
    await page.get_by_test_id("da-subject").fill(subject)
    await page.get_by_test_id("da-desc").fill("Focused E2E verification for camera preview, selfie evidence persistence, and print records.")
    await page.get_by_test_id("da-submit").click()
    await page.get_by_test_id("da-detail-sheet").wait_for(state="visible", timeout=30000)
    link = await page.get_by_test_id("da-link-input").input_value()
    print(f"Created approval public link: {link}")
    assert "/approve/" in link, "Created approval did not expose /approve/:token link"
    token = link.split("/approve/")[-1]
    assert len(token) > 20, "Approval token looks invalid"

    print("STEP 3: Public customer flow - approve, open camera, verify video preview")
    await page.goto(link, wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    body_text = await page.locator("body").inner_text()
    print("Public page sample:", body_text[:500].replace("\n", " | "))
    assert subject in body_text, "Public approval page did not load created subject"
    await page.get_by_test_id("pa-btn-approve").click()
    await page.get_by_test_id("pa-name").wait_for(state="visible", timeout=15000)
    print("PASS: Approval form rendered with pa-name")
    await page.get_by_test_id("pa-name").fill(customer_name)
    await page.get_by_test_id("pa-comment").fill("Automated QA confirms approval with captured selfie evidence.")
    await page.get_by_test_id("pa-selfie-open").click()
    await page.get_by_test_id("pa-video").wait_for(state="attached", timeout=15000)
    await page.wait_for_function("""() => {
      const v = document.querySelector('[data-testid="pa-video"]');
      return v && v.videoWidth > 0 && v.videoHeight > 0;
    }""", timeout=15000)
    video_info = await page.evaluate("""
      () => {
        const v = document.querySelector('[data-testid="pa-video"]');
        const r = v ? v.getBoundingClientRect() : {width:0,height:0};
        return {present: !!v, domWidth: r.width, videoWidth: v?.videoWidth || 0, videoHeight: v?.videoHeight || 0, text: v?.closest('div')?.innerText || ''};
      }
    """)
    print("Video DOM info:", video_info)
    assert video_info["present"] and "CAMERA LIVE" in video_info["text"], "CAMERA LIVE video preview did not render"
    assert video_info["videoWidth"] > 0 and video_info["videoHeight"] > 0, "Video stream has no dimensions"
    print("PASS: Camera preview video element rendered inside CAMERA LIVE box")

    print("STEP 4: Capture selfie and verify same-page evidence preview")
    await page.get_by_test_id("pa-capture-selfie").click()
    await page.get_by_test_id("pa-selfie-preview").wait_for(state="visible", timeout=15000)
    preview_info = await page.evaluate("""
      () => {
        const img = document.querySelector('[data-testid="pa-selfie-preview"]');
        const box = img ? img.parentElement : null;
        const r = img ? img.getBoundingClientRect() : {width:0,height:0};
        const s = box ? getComputedStyle(box) : null;
        return {
          present: !!img,
          srcPrefix: img ? img.src.slice(0, 30) : '',
          width: r.width,
          height: r.height,
          parentText: box ? box.innerText : '',
          borderColor: s ? s.borderTopColor : '',
          background: s ? s.backgroundColor : ''
        };
      }
    """)
    print("Selfie preview info:", preview_info)
    assert preview_info["present"], "Captured selfie preview is missing"
    assert preview_info["srcPrefix"].startswith("blob:"), "Captured preview does not use a local blob image"
    assert preview_info["width"] >= 300, "Captured selfie preview is not prominent/wide"
    assert "SELFIE CAPTURED" in preview_info["parentText"], "Green selfie captured evidence label missing"
    print("PASS: Captured selfie is shown on same page in evidence box")

    print("STEP 5: Submit approval with captured selfie; verify no Uploading photo hang and persisted selfie evidence")
    upload_requests = []
    response_errors = []
    page.on("request", lambda req: upload_requests.append(req.url) if "/storage/v1/object/attachments/approvals/responses/" in req.url else None)
    async def handle_response(resp):
        try:
            if "/storage/v1/object/attachments/approvals/responses/" in resp.url:
                txt = await resp.text()
                response_errors.append({"url": resp.url, "status": resp.status, "text": txt[:500]})
                print(f"Storage upload response: status={resp.status}, body={txt[:300]}")
        except Exception as resp_e:
            print(f"Storage response inspect warning: {resp_e}")
    page.on("response", handle_response)
    await page.get_by_test_id("pa-submit").click()

    final_state = None
    try:
        await page.get_by_test_id("pa-print-evidence").wait_for(state="visible", timeout=60000)
        final_state = "done"
    except Exception as wait_done_e:
        print(f"Done-state wait failed: {wait_done_e}")
        btn_text = await page.get_by_test_id("pa-submit").inner_text() if await page.get_by_test_id("pa-submit").count() else "<no submit button>"
        print(f"Submit button text after wait: {btn_text}")
        assert btn_text != "Uploading photo…" and btn_text != "Uploading photo...", "Submit remained stuck on Uploading photo after selfie upload failure"
        final_state = "reset_after_failure"

    if final_state != "done":
        raise AssertionError(f"Captured-selfie approval did not complete end-to-end; final state={final_state}; storage responses={response_errors}")

    done_text = await page.locator("body").inner_text()
    print("Done page sample:", done_text[:900].replace("\n", " | "))
    assert "Response Evidence" in done_text and customer_name in done_text, "Done page missing response evidence or customer name"
    await page.get_by_test_id("pa-response-selfie").wait_for(state="visible", timeout=20000)
    response_selfie = await page.evaluate("""
      () => {
        const img = document.querySelector('[data-testid="pa-response-selfie"]');
        const r = img ? img.getBoundingClientRect() : {width:0,height:0};
        return {present: !!img, src: img ? img.src : '', width: r.width, naturalWidth: img ? img.naturalWidth : 0, complete: img ? img.complete : false};
      }
    """)
    print("Persisted response selfie info:", response_selfie)
    assert response_selfie["present"], "Done page missing persisted customer selfie image"
    assert "/storage/v1/object/public/attachments/approvals/responses/" in response_selfie["src"], "Done page selfie is not persisted public storage URL"
    assert response_selfie["width"] >= 300, "Done page response selfie is not the larger max-w-md image"
    assert response_selfie["complete"] and response_selfie["naturalWidth"] > 0, "Persisted customer selfie image did not load"
    print("PASS: Submit completed and done page shows persisted selfie evidence")

    print("STEP 6: Customer print popup contains full record and embedded selfie")
    async with context.expect_page() as pub_popup_info:
        await page.get_by_test_id("pa-print-evidence").click()
    pub_popup = await pub_popup_info.value
    await pub_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    pub_text = await pub_popup.locator("body").inner_text()
    pub_img_count = await pub_popup.locator('img[src*="/storage/v1/object/public/attachments/approvals/responses/"]').count()
    print("Customer print popup sample:", pub_text[:800].replace("\n", " | "))
    print(f"Customer print response selfie image count: {pub_img_count}")
    assert "Digital Approval Record" in pub_text, "Customer print popup missing Digital Approval Record heading"
    assert subject in pub_text and customer_name in pub_text and "Customer Response" in pub_text, "Customer print popup missing record/response details"
    assert pub_img_count >= 1, "Customer print popup missing embedded selfie image"
    await pub_popup.close()
    print("PASS: Customer print report includes full record and selfie")

    print("STEP 7: Admin detail sheet after response shows selfie thumbnail and admin print includes same content")
    await page.goto(f"{base}/digital-approvals", wait_until="domcontentloaded")
    await page.get_by_test_id("digital-approvals-page").wait_for(state="visible", timeout=30000)
    await page.get_by_test_id("da-search").fill(subject)
    await page.wait_for_timeout(4000)
    await page.get_by_text(subject, exact=False).first.click()
    await page.get_by_test_id("da-detail-sheet").wait_for(state="visible", timeout=15000)
    admin_text = await page.locator("body").inner_text()
    print("Admin detail sample:", admin_text[:1000].replace("\n", " | "))
    assert "Customer Response" in admin_text and customer_name in admin_text, "Admin detail missing response evidence/name"
    admin_thumb_count = await page.locator('[data-testid="da-detail-sheet"] img[src*="/storage/v1/object/public/attachments/approvals/responses/"]').count()
    print(f"Admin detail response selfie thumbnail count: {admin_thumb_count}")
    assert admin_thumb_count >= 1, "Admin detail sheet missing response selfie thumbnail"
    await page.get_by_test_id("da-print").wait_for(state="visible", timeout=10000)
    async with context.expect_page() as admin_popup_info:
        await page.get_by_test_id("da-print").click()
    admin_popup = await admin_popup_info.value
    await admin_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    admin_popup_text = await admin_popup.locator("body").inner_text()
    admin_img_count = await admin_popup.locator('img[src*="/storage/v1/object/public/attachments/approvals/responses/"]').count()
    print("Admin print popup sample:", admin_popup_text[:800].replace("\n", " | "))
    print(f"Admin print response selfie image count: {admin_img_count}")
    assert "Digital Approval Record" in admin_popup_text, "Admin print popup missing Digital Approval Record heading"
    assert subject in admin_popup_text and customer_name in admin_popup_text and "Customer Response" in admin_popup_text, "Admin print popup missing response details"
    assert admin_img_count >= 1, "Admin print popup missing embedded response selfie image"
    await admin_popup.close()
    print("PASS: Admin evidence and print report include persisted selfie")

    error_text = await page.evaluate("""() => {
      const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
      return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    print("OVERALL RESULT: PASS - Digital Approvals camera/selfie/upload/print flow verified end-to-end")
except Exception as e:
    print(f"OVERALL RESULT: FAIL - {type(e).__name__}: {e}")
    try:
        await page.screenshot(path="/app/test_reports/bug_verification_iteration20_failure.jpg", quality=40, full_page=False)
        print("Failure screenshot captured")
    except Exception as shot_e:
        print(f"Screenshot failed: {shot_e}")
    raise