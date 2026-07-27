# Focused Playwright QA script for Iteration 19 Digital Approvals bug verification.
# This script is passed to the MCP browser automation runner, which executes it
# inside an async function with an existing `page` object.

import re

try:
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.set_default_timeout(20000)
    context = page.context

    print("STEP 1: Install popup/print/dialog handlers and fake camera for public approval flow")
    page.on("dialog", lambda dialog: print(f"Dialog shown: {dialog.message}"))
    await context.add_init_script("""
        (() => {
          window.__printCalled = false;
          const originalOpen = window.open;
          window.print = () => { window.__printCalled = true; console.log('window.print intercepted'); };
          if (!navigator.mediaDevices) navigator.mediaDevices = {};
          navigator.mediaDevices.getUserMedia = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 640; canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f766e'; ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#ffffff'; ctx.font = '42px sans-serif';
            ctx.fillText('FAKE FRONT CAMERA', 95, 240);
            return canvas.captureStream(15);
          };
        })();
    """)

    print("STEP 2: Log in as admin and navigate to Digital Approvals")
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/login", wait_until="domcontentloaded")
    if await page.get_by_test_id("login-email-input").count() > 0:
        await page.get_by_test_id("login-email-input").fill("info.subhendu@gmail.com")
        await page.get_by_test_id("login-password-input").fill("Subhendu8958@")
        await page.get_by_test_id("login-submit-button").click()
        await page.wait_for_timeout(4000)
        print(f"After login URL: {page.url}")
    else:
        print("Already logged in or login form not shown")

    await page.goto("https://lead-conversion-14.preview.emergentagent.com/digital-approvals", wait_until="domcontentloaded")
    await page.get_by_test_id("digital-approvals-page").wait_for(state="visible", timeout=20000)
    print("Digital Approvals page is visible")

    print("STEP 3: Create a real test approval through the UI")
    subject = "QA Camera Print Approval Iter19"
    await page.get_by_test_id("new-approval-btn").click()
    await page.get_by_test_id("da-subject").wait_for(state="visible", timeout=10000)
    await page.get_by_test_id("da-subject").fill(subject)
    await page.get_by_test_id("da-desc").fill("Focused QA record for camera preview, selfie evidence, and print verification.")
    await page.get_by_test_id("da-submit").click()
    await page.wait_for_timeout(5000)
    await page.get_by_test_id("da-detail-sheet").wait_for(state="visible", timeout=20000)
    link = await page.get_by_test_id("da-link-input").input_value()
    print(f"Created approval public link: {link}")
    assert "/approve/" in link, "Created approval did not expose /approve/:token link"
    token = link.split("/approve/")[-1]
    assert len(token) > 10, "Approval token looks invalid"
    print("PASS: Real approval token created via UI")

    print("STEP 4: Verify admin detail sheet print button and popup report before response")
    await page.get_by_test_id("da-print").wait_for(state="visible", timeout=10000)
    async with context.expect_page() as popup_info:
        await page.get_by_test_id("da-print").click()
    admin_popup = await popup_info.value
    await admin_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    admin_popup_text = await admin_popup.locator("body").inner_text()
    print("Admin popup text sample:", admin_popup_text[:500].replace("\n", " | "))
    assert "Digital Approval Record" in admin_popup_text, "Admin print popup missing Digital Approval Record title"
    assert subject in admin_popup_text, "Admin print popup missing approval subject"
    assert "Request Details" in admin_popup_text, "Admin print popup missing request details section"
    await admin_popup.close()
    print("PASS: Admin print popup renders branded approval report")

    print("STEP 5: Open public approval link and verify camera/selfie UI")
    await page.goto(link, wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    assert await page.get_by_text(subject, exact=False).count() > 0, "Public approval page did not load the created subject"
    await page.get_by_test_id("pa-btn-approve").click()
    await page.get_by_test_id("pa-selfie-open").wait_for(state="visible", timeout=10000)
    print("PASS: Public form shows Open Camera button after Approve")

    await page.get_by_test_id("pa-selfie-open").click()
    await page.get_by_test_id("pa-video").wait_for(state="attached", timeout=10000)
    video_info = await page.evaluate("""
        () => {
          const v = document.querySelector('[data-testid="pa-video"]');
          return {
            present: !!v,
            readyState: v ? v.readyState : null,
            videoWidth: v ? v.videoWidth : null,
            videoHeight: v ? v.videoHeight : null,
            text: v ? v.closest('div')?.innerText : ''
          };
        }
    """)
    print(f"Video DOM info: {video_info}")
    assert video_info["present"] is True, "pa-video is not present after Open Camera"
    assert "CAMERA LIVE" in (video_info.get("text") or ""), "Camera live container text not visible"
    print("PASS: Camera preview video element renders after Open Camera")

    # Wait until the fake stream has video dimensions so capturePhoto creates a real image blob.
    await page.wait_for_function("""() => {
      const v = document.querySelector('[data-testid="pa-video"]');
      return v && v.videoWidth > 0 && v.videoHeight > 0;
    }""", timeout=10000)
    await page.get_by_test_id("pa-capture-selfie").click()
    await page.get_by_test_id("pa-selfie-preview").wait_for(state="visible", timeout=10000)
    preview_info = await page.evaluate("""
        () => {
          const img = document.querySelector('[data-testid="pa-selfie-preview"]');
          const box = img ? img.parentElement : null;
          const imgRect = img ? img.getBoundingClientRect() : null;
          const boxStyle = box ? getComputedStyle(box) : null;
          return {
            present: !!img,
            srcPrefix: img ? img.src.slice(0, 20) : null,
            width: imgRect ? imgRect.width : 0,
            height: imgRect ? imgRect.height : 0,
            parentText: box ? box.innerText : '',
            parentBorderColor: boxStyle ? boxStyle.borderTopColor : null,
            parentBackground: boxStyle ? boxStyle.backgroundColor : null
          };
        }
    """)
    print(f"Selfie preview info: {preview_info}")
    assert preview_info["present"] is True, "pa-selfie-preview image is not visible after Capture"
    assert preview_info["srcPrefix"] and preview_info["srcPrefix"].startswith("blob:"), "Selfie preview is not using a captured local image blob"
    assert preview_info["width"] >= 300, "Selfie preview is not rendered as a wide/prominent image"
    assert "SELFIE CAPTURED" in preview_info["parentText"], "Selfie evidence box label missing"
    print("PASS: Captured selfie preview is displayed prominently on the same page")

    print("STEP 6: Submit public approval and verify done-state customer print evidence")
    await page.get_by_test_id("pa-name").fill("QA Customer Iter19")
    await page.get_by_test_id("pa-comment").fill("Approval submitted by automated QA with captured selfie preview.")
    await page.get_by_test_id("pa-submit").click()
    await page.get_by_test_id("pa-print-evidence").wait_for(state="visible", timeout=30000)
    assert await page.get_by_text("Response Evidence", exact=False).count() > 0, "Done state missing Response Evidence section"
    assert await page.get_by_text("QA Customer Iter19", exact=False).count() > 0, "Done state missing typed customer name evidence"
    print("PASS: Public done state shows Print / Save as PDF button and response evidence")

    async with context.expect_page() as pub_popup_info:
        await page.get_by_test_id("pa-print-evidence").click()
    pub_popup = await pub_popup_info.value
    await pub_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    public_popup_text = await pub_popup.locator("body").inner_text()
    print("Public popup text sample:", public_popup_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in public_popup_text, "Public print popup missing Digital Approval Record title"
    assert subject in public_popup_text, "Public print popup missing approval subject"
    assert "Customer Response" in public_popup_text, "Public print popup missing response evidence section"
    assert "QA Customer Iter19" in public_popup_text, "Public print popup missing typed responder name"
    await pub_popup.close()
    print("PASS: Customer-side print popup renders complete evidence report")

    print("STEP 7: Return to admin list, refresh approval, verify detail sheet now includes response evidence and print works")
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/digital-approvals", wait_until="domcontentloaded")
    await page.get_by_test_id("digital-approvals-page").wait_for(state="visible", timeout=20000)
    await page.get_by_test_id("da-search").fill(subject)
    await page.wait_for_timeout(3000)
    await page.get_by_text(subject, exact=False).first.click()
    await page.get_by_test_id("da-detail-sheet").wait_for(state="visible", timeout=10000)
    assert await page.get_by_test_id("da-print").is_visible(), "Admin da-print button not visible after response"
    assert await page.get_by_text("Customer Response", exact=False).count() > 0, "Admin detail sheet missing response evidence section"

    async with context.expect_page() as admin_after_popup_info:
        await page.get_by_test_id("da-print").click()
    admin_after_popup = await admin_after_popup_info.value
    await admin_after_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    admin_after_text = await admin_after_popup.locator("body").inner_text()
    print("Admin-after-response popup text sample:", admin_after_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in admin_after_text, "Admin post-response print popup missing title"
    assert "Customer Response" in admin_after_text, "Admin post-response print popup missing response evidence"
    assert "QA Customer Iter19" in admin_after_text, "Admin post-response print popup missing responder name"
    await admin_after_popup.close()
    print("PASS: Admin print after customer response includes response evidence")

    # Check for user-visible errors surfaced by the app.
    error_text = await page.evaluate("""() => {
      const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
      return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")

    print("OVERALL RESULT: PASS - focused Digital Approvals camera/selfie/print flow verified")
except Exception as e:
    print(f"OVERALL RESULT: FAIL - {type(e).__name__}: {e}")
    try:
        await page.screenshot(path="/app/test_reports/bug_verification_iteration19_failure.jpg", quality=40, full_page=False)
        print("Failure screenshot captured")
    except Exception as shot_e:
        print(f"Screenshot failed: {shot_e}")
    raise