# Control script: verifies print buttons/reports work when public response is
# submitted without a selfie, after the full captured-selfie flow exposed a
# storage upload failure.

try:
    await page.set_viewport_size({"width": 1920, "height": 1080})
    page.set_default_timeout(25000)
    context = page.context
    await context.add_init_script("""window.print = () => { window.__printCalled = true; console.log('window.print intercepted'); };""")
    subject = "QA Print Control No Selfie Iter19"

    print("STEP 1: Login and create a no-selfie control approval")
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/login", wait_until="networkidle")
    if await page.locator('[data-testid="login-email-input"], input[type="email"]').first.count() > 0:
        await page.locator('[data-testid="login-email-input"], input[type="email"]').first.fill("info.subhendu@gmail.com")
        await page.locator('[data-testid="login-password-input"], input[type="password"]').first.fill("Subhendu8958@")
        await page.locator('[data-testid="login-submit-button"], button:has-text("Login")').first.click()
        await page.wait_for_timeout(5000)
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/digital-approvals", wait_until="networkidle")
    await page.locator('[data-testid="digital-approvals-page"], body:has-text("Digital Approvals")').first.wait_for(state="visible", timeout=20000)
    await page.locator('[data-testid="new-approval-btn"], button:has-text("New Approval")').first.click()
    await page.locator('[data-testid="da-subject"], input').first.fill(subject)
    await page.locator('[data-testid="da-desc"], textarea').first.fill("Control response for print verification without selfie upload.")
    await page.locator('[data-testid="da-submit"], button:has-text("Create")').first.click()
    await page.wait_for_timeout(5000)
    await page.locator('[data-testid="da-detail-sheet"], [role="dialog"]').first.wait_for(state="visible", timeout=20000)
    link = await page.locator('[data-testid="da-link-input"], input[value*="/approve/"]').first.input_value()
    print("Control public link:", link)

    print("STEP 2: Public approve without selfie and verify customer print popup")
    await page.goto(link, wait_until="networkidle")
    await page.locator('[data-testid="pa-btn-approve"], button:has-text("Approve")').first.click()
    await page.locator('[data-testid="pa-name"], input[placeholder*="Full name"], input').first.fill("QA Print Control Customer")
    await page.locator('[data-testid="pa-comment"], textarea').first.fill("Control print response without selfie.")
    await page.locator('[data-testid="pa-submit"], button:has-text("CONFIRM APPROVAL")').first.click()
    await page.locator('[data-testid="pa-print-evidence"], button:has-text("Print / Save as PDF")').first.wait_for(state="visible", timeout=30000)
    done_text = await page.locator("body").inner_text()
    print("Done page sample:", done_text[:700].replace("\n", " | "))
    assert "Response Evidence" in done_text and "QA Print Control Customer" in done_text
    async with context.expect_page() as public_popup_info:
        await page.locator('[data-testid="pa-print-evidence"], button:has-text("Print / Save as PDF")').first.click()
    public_popup = await public_popup_info.value
    await public_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    public_popup_text = await public_popup.locator("body").inner_text()
    print("Public control popup sample:", public_popup_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in public_popup_text and "Customer Response" in public_popup_text and "QA Print Control Customer" in public_popup_text
    await public_popup.close()

    print("STEP 3: Admin detail after no-selfie response and print popup")
    await page.goto("https://lead-conversion-14.preview.emergentagent.com/digital-approvals", wait_until="networkidle")
    await page.locator('[data-testid="da-search"], input[placeholder*="Search"]').first.fill(subject)
    await page.wait_for_timeout(3000)
    await page.get_by_text(subject, exact=False).first.click()
    await page.locator('[data-testid="da-detail-sheet"], [role="dialog"]').first.wait_for(state="visible", timeout=10000)
    admin_detail_text = await page.locator("body").inner_text()
    print("Admin detail control sample:", admin_detail_text[:800].replace("\n", " | "))
    assert "Customer Response" in admin_detail_text and "QA Print Control Customer" in admin_detail_text
    assert await page.locator('[data-testid="da-print"], button:has-text("Print / Save PDF")').first.is_visible()
    async with context.expect_page() as admin_popup_info:
        await page.locator('[data-testid="da-print"], button:has-text("Print / Save PDF")').first.click()
    admin_popup = await admin_popup_info.value
    await admin_popup.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(1000)
    admin_popup_text = await admin_popup.locator("body").inner_text()
    print("Admin control popup sample:", admin_popup_text[:700].replace("\n", " | "))
    assert "Digital Approval Record" in admin_popup_text and "Customer Response" in admin_popup_text and "QA Print Control Customer" in admin_popup_text
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
        await page.screenshot(path="/app/test_reports/bug_verification_iteration19_print_control_failure.jpg", quality=40, full_page=False)
        print("Failure screenshot captured")
    except Exception as shot_e:
        print(f"Screenshot failed: {shot_e}")
    raise