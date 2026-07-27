# Bug Verification Iteration 19 — Digital Approvals camera/photo/print

No relevant testing skill found.

## Exact user-reported bug
Digital approval section: front camera preview not working; after capture photo does not show on the same page as evidence; need print of the complete approval/final submission from both admin and customer sides.

## Affected flow
Admin logs in, creates/opens a Digital Approval, copies the public magic link. Customer opens `/approve/:token`, chooses Approve/Request Changes, opens front camera, captures selfie, sees the captured selfie preview, submits response, and can print/save evidence. Admin opens the approval detail sheet and can print/save the complete approval record.

## Changed files inspected
- `/app/frontend/src/pages/PublicApprovePage.jsx`
- `/app/frontend/src/pages/DigitalApprovalsPage.jsx`
- `/app/frontend/src/services/digitalApprovalService.js`
- Git status/history reviewed before testing.

## Direct proof needed
- A real approval token created through `/digital-approvals` loads on `/approve/:token`.
- `pa-selfie-open`, `pa-video`, `pa-capture-selfie`, `pa-selfie-preview`, and `pa-print-evidence` appear in their expected public-page states.
- Captured selfie preview is visibly rendered as a large image inside a green evidence box.
- Customer final evidence print popup renders a branded report with approval subject/request details/response evidence.
- Admin detail sheet contains `da-print`; clicking it opens a print-styled report containing `Digital Approval Record` and response evidence.

## Edge cases in scope
- Headless browser camera limitation handled by a browser-side fake MediaStream for this test only, to simulate a granted front camera and verify the React camera/capture UI path.
- Verify complete create → public submit → admin refresh/detail → print data flow, not only static selectors.