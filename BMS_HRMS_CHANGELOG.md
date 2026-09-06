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
- **Application changes:**
  - Vendor documents are now read through short-lived signed URLs.
  - Uploads continue using the existing `{vendorId}/{kind}.{ext}` object-path convention.
  - Existing stored public-style URLs remain usable as stable object references; they are converted to signed URLs at read time.
  - New uploads store the stable object URL reference but return a signed URL for immediate display.
- **Preserved:** Existing vendor document objects were not deleted or moved; only access control was changed.
- **Regression required:** Vendor document upload, replacement, viewing, and deletion must be tested after the new Vercel deployment becomes READY.

## AI HANDOVER
Before any further change, re-check current Git/Supabase/Vercel state. Never infer organizational role solely from historical database role values. Keep BMS and HRMS separate until a future explicit merge project is approved.
