# Continuation script for Iteration 19 focused bug verification.
# Uses the real approval token created by the first browser test run and
# completes public camera/selfie/print + admin post-response print verification.

subject = "QA Camera Print Approval Iter19 Retry"
link = "https://lead-conversion-14.preview.emergentagent.com/approve/955e12fe815840aa9cc2473d7c82d8f10ca7a2e121244ec3834926390631b1b7"

try:
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.set_default_timeout(25000)
    context = page.context
    await context.add_init_script("""
      (() => {
        window.print = () => { window.__printCalled = true; console.log('window.print intercepted'); };
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0f766e'; ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#fff'; ctx.font = '42px sans-serif';
          ctx.fillText('FAKE FRONT CAMERA', 95, 240);
          return canvas.captureStream(15);
        };
      })();
    """)

    print("STEP 1: Re-open public approval link with fake camera")
    await page.goto(link, wait_until="networkidle")
    # Ensure override is active for the already-created page as well.
    await page.evaluate("""
      () => {
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0f766e'; ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#fff'; ctx.font = '42px sans-serif';
          ctx.fillText('FAKE FRONT CAMERA', 95, 240);
          return canvas.captureStream(15);
        };
      }
    """)
    public_text = await page.locator("body").inner_text()
    print("Public page sample:", public_text[:600].replace("\n", " | "))
    assert subject in public_text, "Public page did not load the expected approval subject"
    assert "APPROVED" not in public_text[:200], "Approval already appears completed before this continuation test"

    print("STEP 2: Approve, open camera, and verify video DOM")
    await page.locator('[data-testid="pa-btn-approve"], button:has-text("Approve")').first.click()
    await page.locator('[data-testid="pa-selfie-open"], button:has-text("Open Camera")').first.wait_for(state="visible", timeout=10000)
    await page.locator('[data-testid="pa-selfie-open"], button:has-text("Open Camera")').first.click()
    await page.locator('[data-testid="pa-video"], video').first.wait_for(state="attached", timeout=10000)
    video_info = await page.evaluate("""
      () => {
        const v = document.querySelector('[data-testid="pa-video"], video');
        return {present: !!v, width: v ? v.getBoundingClientRect().width : 0, text: v ? v.closest('div')?.innerText : ''};
      }
    """)
    print("Video DOM info:", video_info)
    assert video_info["present"] and "CAMERA LIVE" in video_info["text"], "Camera preview DOM did not render after Open Camera"

    print("STEP 3: Capture photo and verify same-page selfie evidence preview")
    await page.wait_for_function("""() => {
      const v = document.querySelector('[data-testid="pa-video"], video');
      return v && v.videoWidth > 0 && v.videoHeight > 0;
    }""", timeout=10000)
    await page.locator('[data-testid="pa-capture-selfie"], button:has-text("Capture")').first.click()
    await page.locator('[data-testid="pa-selfie-preview"], img[alt="Selfie"]').first.wait_for(state="visible", timeout=10000)
    preview_info = await page.evaluate("""
      () => {
        const img = document.querySelector('[data-testid="pa-selfie-preview"], img[alt="Selfie"]');
        const box = img ? img.parentElement : null;
        const r = img ? img.getBoundingClientRect() : {width:0,height:0};
        const s = box ? getComputedStyle(box) : null;
        return {
          present: !!img,
          srcPrefix: img ? img.src.slice(0, 20) : '',
          width: r.width,
          height: r.height,
          parentText: box ? box.innerText : '',
          border: s ? s.borderTopColor : '',
          background: s ? s.backgroundColor : ''
        };
      }
    """)
    print("Selfie preview info:", preview_info)
    assert preview_info["present"], "Selfie preview image is missing after Capture"
    assert preview_info["srcPrefix"].startswith("blob:"), "Selfie preview is not showing a locally captured blob image"
    assert preview_info["width"] >= 300, "Selfie preview is not prominent/wide"
    assert "SELFIE CAPTURED" in preview_info["parentText"], "Green evidence box label missing"

    print("STEP 4: Submit public approval and verify customer-side print evidence")
    await page.locator('[data-testid="pa-name"], input[placeholder*="Full name"], input').first.fill("QA Customer Iter19")
    await page.locator('[data-testid="pa-comment"], textarea').first.fill("Approval submitted by automated QA with captured selfie preview.")
    await page.locator('[data-testid="pa-submit"], button:has-text("CONFIRM APPROVAL")').first.click()
    await page.locator('[data-testid="pa-print-evidence"], button:has-text("Print / Save as PDF")').first.wait_for(state="visible", timeout=45000)
    done_text = await page.locator("body").inner_text()
    print("Done page sample:", done_text[:700].replace("\n", " | "))
    assert "Response Evidence" in done_text and "QA Customer Iter19" in done_text, "Done page missing response evidence"
    async with context.expect_page() as public_popup_info:
        await page.locator('[data-testid="pa-print-evidence"], button:has-text("Print / Save as PDF")').first.click()
    public_popup = await public_popup_info.value
    await public_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    public_popup_text = await public_popup.locator("body").inner_text()
    print("Public print popup sample:", public_popup_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in public_popup_text
    assert subject in public_popup_text
    assert "Customer Response" in public_popup_text
    assert "QA Customer Iter19" in public_popup_text
    await public_popup.close()

    print("STEP 5: Log in as admin, open updated approval, and verify admin print evidence")
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/login", wait_until="networkidle")
    if await page.locator('[data-testid="login-email-input"], input[type="email"]').first.count() > 0:
        await page.locator('[data-testid="login-email-input"], input[type="email"]').first.fill("info.subhendu@gmail.com")
        await page.locator('[data-testid="login-password-input"], input[type="password"]').first.fill("Subhendu8958@")
        await page.locator('[data-testid="login-submit-button"], button:has-text("Login")').first.click()
        await page.wait_for_timeout(5000)
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/digital-approvals", wait_until="networkidle")
    await page.locator('[data-testid="digital-approvals-page"], body:has-text("Digital Approvals")').first.wait_for(state="visible", timeout=20000)
    await page.locator('[data-testid="da-search"], input[placeholder*="Search"]').first.fill(subject)
    await page.wait_for_timeout(3000)
    await page.get_by_text(subject, exact=False).first.click()
    await page.locator('[data-testid="da-detail-sheet"], [role="dialog"]').first.wait_for(state="visible", timeout=10000)
    admin_detail_text = await page.locator("body").inner_text()
    print("Admin detail sample:", admin_detail_text[:800].replace("\n", " | "))
    assert "Customer Response" in admin_detail_text and "QA Customer Iter19" in admin_detail_text
    assert await page.locator('[data-testid="da-print"], button:has-text("Print / Save PDF")').first.is_visible()
    async with context.expect_page() as admin_popup_info:
        await page.locator('[data-testid="da-print"], button:has-text("Print / Save PDF")').first.click()
    admin_popup = await admin_popup_info.value
    await admin_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    admin_popup_text = await admin_popup.locator("body").inner_text()
    print("Admin print popup sample:", admin_popup_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in admin_popup_text
    assert "Customer Response" in admin_popup_text
    assert "QA Customer Iter19" in admin_popup_text
    await admin_popup.close()

    error_text = await page.evaluate("""() => {
      const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
      return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")
    print("OVERALL RESULT: PASS")
except Exception as e:
    print(f"OVERALL RESULT: FAIL - {type(e).__name__}: {e}")
    try:
        await page.screenshot(path="/app/test_reports/bug_verification_iteration19_continuation_failure.jpg", quality=40, full_page=False)
        print("Failure screenshot captured")
    except Exception as shot_e:
        print(f"Screenshot failed: {shot_e}")
    raise