# BMS + HRMS Change Log / AI Handover

> Purpose: This file is the shared source of truth for approved decisions, verified current behavior, planned work, and implemented changes.

## 0. Non-Negotiable Rules
- Read-only inspection first unless explicitly approved.
- **Improve now, merge later.** BMS and HRMS remain separate.
- Preserve existing working functionality and multi-user Lead/Project assignments.
- Security/permission changes must be enforced server-side/database-side where appropriate.

## 1. Verified BMS Baseline
- React SPA on Vercel.
- Supabase Auth + Postgres + Storage are the active business-data architecture.
- Legacy FastAPI/MongoDB code exists but is not treated as the active BMS business backend.

### Functional roles agreed
1. Admin
2. Relationship Manager (RM)
3. Relationship Executive (RE)

### Agreed access model
- Admin: company-wide control.
- RM: own/team/assigned business scope.
- RE: permitted assigned/co-assigned business scope.
- An RE may relate to one or more RMs.
- Employee salary/payroll/bank information remains a separate sensitive domain in HRMS.
- View/Create/Edit/Delete/Approve remain separate permission concepts.

### Existing assignment mechanisms to preserve
- `lead_assignees`
- `project_members`

## 2. Audit / Planning Completed
The BMS permission audit mapped UI → services → Supabase tables/RPCs → RLS and identified the highest-risk areas: Vendor Bills, Receipts, Vendor Payments, Audit Log, Notifications, plus broader Customer/Estimate/Agreement/Project authorization gaps.

The authorization blueprint uses Role + Relationship + Scope + Action + Sensitivity.

## 3. HRMS Rules
- Admin / RM / RE functional model.
- RM may access operational team attendance/field visits.
- RM/RE must not see down-level employee salary/payroll/bank information by default.
- HRMS remains separate from BMS for now.

## 4. Future BMS ↔ HRMS Direction
- Controlled employee identity mapping.
- Lead → Field Visit connection.
- Customer → Project → Employee lifecycle.
- Integration first; database merge only as a later, separately approved project.

## CHANGE LOG

### CHANGE #001 — Project Baseline / Permission Architecture
- **Date:** 2026-09-07
- **System:** BMS + HRMS
- **Status:** BASELINE COMPLETE
- **Approved:** Yes
- **Behavior changed:** No
- **Summary:** Established the three-role model, scoped business access, HRMS operational-vs-salary separation, preservation of multi-user assignments, and the implementation roadmap.

### CHANGE #002 — P0 Authorization Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / APPLICATION REGRESSION REQUIRED
- **Approved:** Yes — explicit user authorization received.
- **Scope:** High-risk financial, audit and notification access.
- **Database changes implemented:**
  - Added private RLS helper functions for project, lead and customer access with pinned search paths and no direct Data API execution.
  - `vendor_bills`: project-scoped SELECT/INSERT; creator/admin UPDATE; admin-only direct DELETE.
  - `vendor_payments`: project-scoped SELECT/INSERT; creator/admin UPDATE/DELETE.
  - `receipts`: SELECT follows project/lead/customer/creator scope; INSERT requires authenticated creator plus matching scope, while preserving unlinked manual receipt creation.
  - `audit_log`: direct INSERT restricted to admin or authenticated actor; existing SECURITY DEFINER audit trigger remains available.
  - `notifications`: direct INSERT restricted to self/admin; privileged server-side notification functions remain available.
  - Pinned `search_path` for `set_updated_at` and `set_receipt_si_no`.
  - Anonymous execution of privileged `admin_send_notification` revoked; authenticated execution retained for the existing server-side admin email check.
- **Preserved:** Lead assignment/co-assignment, project membership, soft-delete workflows and public token workflows.
- **Application code:** No functional UI code was changed in this database phase.
- **Deployment:** Supabase migration applied to live BMS project. Vercel deployment was not changed by this migration.
- **Regression required:** Vendor Bills, Vendor Payments, Receipts, delete-request notifications, Audit Log, and admin notifications must be tested in the live application.
- **Next phase:** P1 relationship authorization for Customers/Estimates/Projects/Documents/Agreements/Digital Approvals, followed by UI permission abstraction and Admin permission overrides.

### CHANGE #003 — Vendor Sensitive/KYC Access Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / APPLICATION DEPLOYMENT IN PROGRESS
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Vendor master data and sensitive KYC/bank information.
- **Database changes implemented:**
  - Restricted direct `vendors` table SELECT to Admins and the vendor creator.
  - Restricted vendor INSERT to the authenticated creator.
  - Restricted vendor UPDATE to Admins/vendor creator and added WITH CHECK protection against changing ownership.
  - Restricted vendor DELETE to Admins/vendor creator.
  - Added `vendor_directory` with only operational/non-KYC fields for authenticated vendor lookup.
  - Anonymous access to `vendor_directory` revoked; authenticated SELECT granted.
- **Sensitive fields protected from ordinary vendor-directory reads:** PAN, Aadhaar, UPI, bank account, IFSC, bank name and vendor identity-card URL fields are not exposed through the directory view.
- **Application changes:** Vendor service now uses the safe directory for general vendor lists and vendor lookups when the caller is not permitted to read the full vendor row. Vendor payment/bill lookups use the safe directory for vendor display data.
- **Preserved:** Admin/creator full vendor editing and creation workflows; vendor bills/payments remain project-scoped.
- **Known follow-up:** The legacy `vendor-docs` Storage bucket is still public. A separate storage hardening step is required before treating vendor document confidentiality as fully complete, because changing it immediately would require coordinated signed-URL/UI changes.

### CHANGE #004 — Private Vendor Document Storage
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / APPLICATION DEPLOYMENT PENDING
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Vendor photos, ID cards and visiting cards stored in Supabase Storage.
- **Database/Storage changes implemented:**
  - Changed `vendor-docs` bucket from public to private.
  - Removed the public-read storage policy.
  - Added authenticated Storage SELECT/INSERT/UPDATE/DELETE policies scoped to the vendor UUID in the first folder segment of each object path.
  - Added private `can_access_vendor(uuid)` helper so only Admins or the vendor creator can access these documents.
  - Preserved upsert support by allowing SELECT + INSERT + UPDATE for authorized vendor documents.
  - Granted the authenticated role EXECUTE on the helper after verification showed that RLS evaluation requires the privilege; anonymous EXECUTE remains revoked.
- **Application changes:**
  - Vendor documents are now read through short-lived signed URLs.
  - Uploads continue using the existing `{vendorId}/{kind}.{ext}` object-path convention.
  - Existing stored public-style URLs remain usable as stable object references; they are converted to signed URLs at read time.
  - New uploads store the stable object URL reference but return a signed URL for immediate display.
- **Preserved:** Existing vendor document objects were not deleted or moved; only access control was changed.
- **Regression required:** Vendor document upload, replacement, viewing, and deletion must be tested after the new Vercel deployment becomes READY.

### CHANGE #005 — Centralized UI Permission Matrix
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Central role/action authorization abstraction for the React UI.
- **Application changes implemented:**
  - Added `frontend/src/utils/permissions.js` with normalized Admin/RM/RE roles and separate VIEW/CREATE/EDIT/DELETE/ASSIGN/SEND/RESTORE/PURGE actions.
  - Added `frontend/src/hooks/usePermissions.js` exposing `can`, `canAny`, and `canAll` helpers to pages/components.
  - Updated `AuthContext` to normalize legacy `manager`/`executive` role labels to RM/RE without changing stored role data.
  - Added a reusable `PermissionRoute` guard and verified it supports both nested routes and direct children.
  - Applied VIEW guards to Leads, Customers, Estimates, Receipts, Projects, Vendors, Digital Approvals, Agreements and Reports; CREATE/EDIT guards were applied to Agreement editor routes.
  - Kept existing Admin-only Team, Approvals, Agreement Templates, Audit Log and Super Admin notification routes intact.
  - Preserved public verification/signing/approval routes and print-route placement.
- **Security boundary:** This matrix is a UI authorization layer only. Supabase RLS remains the server-side enforcement boundary and is not weakened by these changes.
- **Conservative adjustment:** Broad Reports VIEW access was removed from RM/RE; Reports remain Admin-only because report sensitivity has not yet been fully verified.
- **Deployment:** Latest production deployment for commit `3f7a3ed201f0283b0131fd16386a5cfff1301e95` is READY. Build completed successfully; only a pre-existing React Hook dependency warning was reported.
- **Preserved:** Existing navigation and role flags; no database role data was remapped.

### CHANGE #006 — Reusable Action Permission Gate / Customer Actions
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Move authorization from route-only protection toward action-level UI controls.
- **Application changes implemented:**
  - Added reusable `PermissionGate` component for resource/action checks.
  - Customer Management now hides New Customer unless CREATE is allowed.
  - Customer Edit is shown only when EDIT is allowed.
  - New Receipt shortcut is shown only when receipt CREATE is allowed.
  - Customer delete-request control is shown only when DELETE is allowed.
  - Customer form submit is guarded by the matching CREATE/EDIT permission in addition to the UI visibility check.
- **Security boundary:** UI checks do not replace Supabase RLS. Existing database enforcement remains authoritative.

### CHANGE #007 — Lead Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Lead create/edit/status/assignment/conversion/bulk actions.
- **Application changes implemented:**
  - Lead page New Lead and empty-state Create Lead controls now require `leads:create`.
  - Lead import now requires `leads:create`; export remains available to users with `leads:view`.
  - Lead form independently enforces CREATE vs EDIT before saving.
  - Lead status and bulk priority/status changes require EDIT.
  - Primary/co-assignee bulk actions require ASSIGN.
  - Lead conversion requires customer CREATE permission.
  - Delete-request and cancel-delete actions require DELETE.
  - Bulk action bar now hides unavailable actions instead of exposing unauthorized controls.
- **Security boundary:** These are UI/action checks layered over the existing Supabase RLS policies; they do not replace database authorization.
- **Files changed:** `frontend/src/pages/LeadsPage.jsx`, `frontend/src/components/leads/LeadFormDialog.jsx`, `frontend/src/components/leads/LeadBulkActionBar.jsx`.
- **Deployment:** Vercel production deployment is confirmed READY on the subsequent stable production build.
- **Next:** Receipts, Vendors, Vendor Bills/Payments, Expenses, Agreements and Digital Approvals, followed by full regression/security verification.

### CHANGE #008 — Project Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Project create/edit/delete controls and form enforcement.
- **Application changes implemented:**
  - Project New/Create controls now require `projects:create`.
  - Project Edit controls require `projects:edit`.
  - Project Delete is enforced through `projects:delete` rather than a standalone UI `isAdmin` check.
  - Project form submission independently validates CREATE vs EDIT permission before calling the service.
  - Unauthorized project action menus are hidden.
  - Existing project VIEW route and project membership behavior are preserved.
- **Security boundary:** UI/action checks are layered over Supabase RLS and do not replace database enforcement.
- **Files changed:** `frontend/src/pages/ProjectsPage.jsx`, `frontend/src/components/projects/ProjectFormDialog.jsx`.
- **Deployment:** Vercel production deployment for the corrected build commit `9f07e8dee8604879490eedd41f74cb6a791b4b55` is confirmed READY. Historical failed builds were caused by the missing `PageBody` closing tag and are not the active production version.
- **Next:** Receipts, Vendors, Vendor Bills/Payments, Expenses, Agreements and Digital Approvals, followed by full regression/security verification.

### CHANGE #009 — Agreement Action-Level Permission Controls
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Agreement create/edit/send/void/delete UI actions.
- **Application changes implemented:**
  - New Agreement controls require `agreements:create`.
  - Agreement Edit requires `agreements:edit`.
  - Send-for-Digital-Signature is controlled by `agreements:send`.
  - Void and Move-to-Trash remain Admin-only through the current permission matrix.
  - Agreement Templates remain Admin-only.
  - View/PDF remains available to users with `agreements:view`.
  - Existing route guards, public signing/token workflows and database RLS remain preserved.
- **Security boundary:** UI/action checks are layered over Supabase RLS and do not replace database enforcement.
- **Files changed:** `frontend/src/pages/AgreementsPage.jsx`.
- **Deployment:** Vercel production deployment for commit `aba35768acfede1b9384401d4f1a46597d099edc` is confirmed READY.

### CHANGE #010 — Service-Level Action Authorization: Receipts, Vendors and Digital Approvals
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** APPLICATION IMPLEMENTED / DEPLOYMENT COMPLETE
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Enforce the centralized Admin/RM/RE action matrix at service-call boundaries in addition to UI controls and Supabase RLS.
- **Receipt service:** Receipt create/edit/delete operations now verify the caller's current role/action before database mutation; existing RLS remains authoritative.
- **Vendor service:** Vendor master CREATE/EDIT/DELETE remains Admin-only; vendor payments and bills allow Admin/RM/RE CREATE, Admin/RM EDIT and Admin-only DELETE; safe vendor-directory reads and private vendor document signed URLs remain preserved.
- **Digital Approval service:** VIEW is available to Admin/RM/RE; CREATE/EDIT/SEND are Admin/RM; DELETE is Admin-only. Public customer magic-link response/signing RPCs remain untouched.
- **Security boundary:** These client service checks are defense-in-depth and do not replace database RLS.
- **Verified deployment:** Vercel Production deployment for commit `7d459e0f02ed21a3d64961f6cd6c2cb992b758ae` is confirmed READY.
- **Next:** Finish remaining action-level UI/service coverage, then perform end-to-end regression across Admin/RM/RE and review remaining sensitive storage/data paths.

### CHANGE #011 — Final Authorization Regression Hardening
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / REGRESSION IN PROGRESS
- **Approved:** Yes — explicit user authorization received.
- **Scope:** Close remaining direct database/RPC bypasses discovered during final regression.
- **Database changes implemented:**
  - Vendor master INSERT/UPDATE/DELETE locked to Admin.
  - Estimate, Expense, Agreement, Digital Approval and Vendor Payment DELETE locked to Admin.
  - Receipt attachment INSERT/SELECT/UPDATE/DELETE now follows the underlying receipt relationship/ownership rules.
  - Lead/Customer/Receipt delete-request and cancellation RPCs now authenticate and enforce requester/admin/scope rules.
  - Internal expiration/reminder scheduler RPC execution removed from end users.
  - `get_receipt_attachments_by_receipt(uuid)` can no longer be executed by anon or authenticated users; the previous public function could retrieve attachments using only a receipt UUID and was therefore treated as an unnecessary direct-access path. The public QR verification page uses `verify_receipt` and does not require this attachment RPC.
  - Vendor direct SELECT remains Admin-only; RM/RE use the safe non-KYC vendor directory.
- **Verification:** Critical RLS policies were re-read after migration. Admin-only destructive operations and relationship-scoped reads/writes are present.
- **Supabase advisor:** Remaining warnings are primarily intentional public token/signature/verification SECURITY DEFINER RPCs, controlled authenticated helper RPCs, the intentionally security-definer `vendor_directory` view, and leaked-password protection being disabled. These require targeted review rather than blanket revocation because several are part of working customer/public workflows.
- **Production:** Latest BMS Vercel deployment `dpl_Hv3rhjUzqPTNc7uxo34eBDb31zay` remains READY/Production on commit `fe7099564a528e5a69c72e690a5ff21628ad2419`; runtime error query returned no logs for the checked criteria.
- **Next:** Complete Vendor/Digital Approval UI action cleanup where safely possible, then run full Admin/RM/RE + direct-Supabase + public-workflow regression, followed by HRMS deep security hardening.

### CHANGE #012 — RM Lead Team Visibility + Webhook Unassigned Leads
- **Date:** 2026-09-07
- **System:** BMS
- **Status:** DATABASE IMPLEMENTED / APPLICATION COMMIT READY
- **Approved:** Yes — explicit user implementation request.
- **Scope:** Relationship Manager lead visibility and RM → RE co-assignment.
- **Requirement implemented:** An RM can access leads created by the RM, leads directly assigned to the RM, leads assigned/co-assigned to an RE in that RM's active `rm_re_assignments` team, and webhook/system-created leads that are still unassigned (`created_by IS NULL` and `assigned_to IS NULL`).
- **Database changes:**
  - Expanded `private.can_access_lead(uuid)` with the webhook-unassigned scope while retaining existing creator/primary/co-assignee and RM→RE relationship logic.
  - `leads_select` and `leads_update` now use the centralized relationship-aware lead access helper.
  - `lead_assignees_select` now follows the same lead scope so RM team leads include their assignee details.
  - `lead_assignees_insert/delete` now explicitly allow an RM to manage a team RE on an accessible lead, while preserving existing admin/creator/primary/co-assignee behavior.
- **Live team mapping verified:** Both Soumen Biswas and Arijit Roy are currently RMs. The live `rm_re_assignments` table currently maps each of them to the active REs Amit Ray, Sarmistha Halder and Soumit Ghosh.
- **Current live-scope regression counts:** Arijit has 782 leads in the new relationship-aware scope; Soumen has 628. These totals include overlaps and are not simple sums of the individual categories.
- **Application changes:** `AssigneeManager.jsx` now identifies the logged-in RM's active team REs and limits RM co-assignment candidates to those REs. Labels were updated from RM-specific wording to team-assignee wording.
- **Preserved:** Existing `lead_assignees` multi-assignment infrastructure, admin controls, RE relationships, lead creation/update behavior, and BMS/HRMS separation.
- **Validation:** Live RLS policies were re-read after migration. The production frontend commit still requires Vercel deployment/READY verification before treating the UI portion as live.

## AI HANDOVER
Before any further change, re-check current Git/Supabase/Vercel state. Never infer organizational role solely from historical database role values. Keep BMS and HRMS separate until a future explicit merge project is approved.
