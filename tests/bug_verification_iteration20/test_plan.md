# Bug Verification Iteration 20 — Digital Approvals camera/selfie/print

No relevant testing skill found.

## Exact user-reported bug
Digital approval section: front camera preview not working; captured photo not shown on same page as evidence; need print of the complete approval/final submission from both admin and customer sides. Follow-on blocker from iteration 19: captured-selfie submission got stuck on `Uploading photo…` because anon Supabase Storage upload failed.

## Affected flow
Admin logs in → creates Digital Approval → opens public `/approve/:token` link → customer approves, opens camera, captures selfie, confirms approval → final evidence page displays persisted selfie and print button → admin detail view displays response selfie and print button.

## Changed files inspected
- `/app/frontend/src/pages/PublicApprovePage.jsx`: camera stream attachment effect, captured selfie preview, submit `try/finally` for `setSelfieUploading(false)`, customer print helper.
- `/app/frontend/src/services/digitalApprovalService.js`: anon upload path `attachments/approvals/responses/*.jpg` and public response RPC.
- `/app/frontend/src/pages/DigitalApprovalsPage.jsx`: admin detail evidence thumbnail and print helper.
- `/app/supabase_schema_v14_fix2.sql`: narrow anon storage insert policy for `approvals/responses/%`.

## Direct proof needed
- `pa-video` renders in the CAMERA LIVE box after Open Camera.
- `pa-selfie-preview` appears as a prominent captured blob image in the green `✓ SELFIE CAPTURED` box.
- After `CONFIRM APPROVAL`, UI does not remain stuck on `Uploading photo…`; captured selfie upload and submit either complete or reset on failure.
- Done page shows `pa-response-selfie` from persisted public URL.
- Customer print popup contains `Digital Approval Record`, response details, and embedded selfie image.
- Admin detail sheet for the same approval shows Customer Response evidence with selfie thumbnail, and admin print popup contains the same record/selfie.

## Edge cases in scope
- Storage upload failure/reset state (specific previous blocker).
- Print popup content from both customer and admin pages.
- Admin UI refresh after public response persistence.