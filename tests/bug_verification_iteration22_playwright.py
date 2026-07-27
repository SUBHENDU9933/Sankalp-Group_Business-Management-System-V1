"""
Focused Iteration 22 UI verification script for mcp_browser_automation.

This file records the exact browser checks performed against the preview UI:
admin login -> /digital-approvals -> target approval -> detail sheet -> selfie/map grid.
It is intentionally scoped to the user-reported admin detail-sheet gap.
"""

async def run(page):
    await page.set_viewport_size({"width": 1920, "height": 1080})
    await page.goto('https://lead-conversion-14.preview.emergentagent.com/login', wait_until='domcontentloaded')
    await page.get_by_test_id('login-email-input').fill('info.subhendu@gmail.com')
    await page.get_by_test_id('login-password-input').fill('Subhendu8958@')
    await page.get_by_test_id('login-submit-button').click()
    await page.wait_for_timeout(3000)

    await page.goto('https://lead-conversion-14.preview.emergentagent.com/digital-approvals', wait_until='domcontentloaded')
    await page.get_by_test_id('da-search').wait_for(state='visible', timeout=30000)
    await page.get_by_test_id('da-search').fill('Watermark & Map Test ogmf86')
    await page.wait_for_timeout(1800)

    target_id = '42a5a757-81dc-4745-81df-da34171fa6eb'
    await page.get_by_test_id(f'da-card-{target_id}').wait_for(state='visible', timeout=30000)
    await page.get_by_test_id(f'da-card-{target_id}').click(force=True)

    await page.get_by_test_id('da-detail-sheet').wait_for(state='visible', timeout=15000)
    await page.get_by_test_id('da-detail-selfie').wait_for(state='visible', timeout=10000)
    await page.get_by_test_id('da-detail-map').wait_for(state='visible', timeout=10000)
    await page.wait_for_timeout(3000)

    details = await page.evaluate("""() => {
        const selfie = document.querySelector('[data-testid="da-detail-selfie"]');
        const map = document.querySelector('[data-testid="da-detail-map"]');
        if (!selfie || !map) return {found: false};
        const parent = selfie.parentElement;
        const style = window.getComputedStyle(parent);
        const sr = selfie.getBoundingClientRect();
        const mr = map.getBoundingClientRect();
        return {
            found: true,
            sameParent: parent === map.parentElement,
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns,
            childCount: parent.children.length,
            sideBySide: Math.abs(sr.y - mr.y) < 20 && mr.x > sr.x + (sr.width * 0.7),
            mapHref: map.getAttribute('href'),
            mapText: map.textContent || ''
        };
    }""")

    popup_future = page.wait_for_event('popup', timeout=10000)
    await page.get_by_test_id('da-detail-map').click(force=True)
    popup = await popup_future
    await popup.wait_for_load_state('domcontentloaded', timeout=15000)
    popup_url = popup.url
    await popup.close()

    assert details.get('found')
    assert details.get('sameParent')
    assert details.get('display') == 'grid'
    assert details.get('childCount') == 2
    assert details.get('sideBySide')
    assert details.get('mapHref', '').startswith('https://maps.google.com/?q=')
    assert popup_url.startswith('https://www.google.com/maps') or popup_url.startswith('https://maps.google.com/')

    return {"details": details, "popup_url": popup_url}