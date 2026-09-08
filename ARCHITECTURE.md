# Sankalp Group Business Management System — Architecture Reference

Last audited: 2026-09-08 (commit `e2b8bf7`). This file is the source of truth for
"what exists and how it works" — read this before making changes, and update it
when architecture (not just features) changes.

## 1. Infrastructure

- **GitHub:** https://github.com/SUBHENDU9933/Sankalp-Group_Business-Management-System-V1 (public repo, main branch, auto-deploys to Vercel on push)
- **Live app:** app.sankalpinterior.com — Vercel project `prj_CreTRlmansfeLrhqBihBk72pWHWz`, team `team_M6PMW9LqAcXDgO7tVi0ZTADt`
- **Database:** Supabase project `tbfzxmbvzpszjldupycy` — Postgres + Auth + Storage + pg_cron + Realtime
- **Stack:** React (CRA + craco) + Tailwind + shadcn/ui (Radix) + Supabase JS client + jsPDF/html2canvas (PDF export) + recharts (lazy-loaded, Reports only)
- **A second Supabase project exists for the marketing website** (sankalpinterior.com's own lead-capture form) — it webhooks INSERTs into this app's `sync-website-lead` Edge Function to auto-create leads here. Two separate Supabase projects, one data flow.

## 2. Access model — THIS IS THE MOST IMPORTANT SECTION

The app was hardened into a real three-role system after the initial build. **Every
new feature must account for all three roles**, both in the UI and in Postgres RLS —
the two layers are independent and both must agree, or one role silently sees
broken/empty pages.

### Roles
`profiles.role` enum: `admin`, `rm` (Relationship Manager / team lead), `re` (Relationship
Executive / individual contributor). Normalized via `normalizeRole()` in both
`frontend/src/utils/permissions.js` (client) and inline SQL (`lower(role) in (...)`,
also accepts legacy `manager`/`executive` spellings).

**Hierarchy:** an RM can have REs assigned under them via `rm_re_assignments`
(rm_id, re_id, assigned_by, is_active). An RM can see/manage everything their
REs can see, via `private.can_manage_re(re_id)`. Admin sees everything, always.

### Two independent enforcement layers (both required)
1. **Client-side UI gating** — `frontend/src/utils/permissions.js` exports a
   `MATRIX` of `{resource: [actions]}` per role (admin implicitly gets everything).
   Consumed via `usePermissions()` hook → `<PermissionGate resource action>` (hide/show
   UI elements) and `<PermissionRoute resource action>` (block whole routes, redirects to `/`).
   This ONLY controls what the UI shows — it is not security, just UX.
2. **Server-side RLS (the actual security boundary)** — every table has real Postgres
   RLS policies. Direct-ownership resources (leads, customers, projects, receipts,
   agreements, digital_approvals, estimates, expenses, vendor_bills, vendor_payments,
   project_documents) resolve access through `private.can_access_<resource>(id)`
   helper functions, which chain: is_admin() OR own row OR assigned-to-me OR
   (I'm an RM and this belongs to one of my REs) OR project/customer/lead
   inheritance. See section 4 for the exact functions.
   Some services (`vendorService.js`) ALSO do a client-side `assertPermission()`
   check before mutating, as defense in depth / better error messages — this is
   redundant with RLS by design, not a replacement for it.

### The vendors table is special-cased
`vendors` (the base table with GST/PAN/Aadhar/bank details) has RLS
`vendors_select: is_admin()` — **RM and RE cannot SELECT from `vendors` directly,
at all.** Instead there's a view `public.vendor_directory` (id, name, type, phone,
email, address, is_active, created_at, updated_at, created_by — NO financial/KYC
fields) that RM/RE query instead. `vendorService.js` branches on role: admin →
`vendors` table with full fields + signed URLs for docs; RM/RE → `vendor_directory`.
Vendor documents (`vendor-docs` storage bucket) are **private**, served via
`createSignedUrl()` with a 1-hour TTL, not public URLs.
**Lesson for future vendor-related work:** any new vendor-adjacent feature needs
to decide up front whether it needs full vendor KYC (admin-only) or just
name/type/phone (safe for RM/RE via vendor_directory), and wire both the RLS
and the service function accordingly — don't just query `vendors` and assume
it'll work for all roles.

### Permission matrix (from `utils/permissions.js`, current as of audit)
- **RM:** leads (view/create/edit/assign/send), customers (view/create/edit),
  estimates (view/create/edit/delete/send), projects (view/create/edit),
  receipts (view/create/edit), vendors (view only, via directory), vendor_bills
  (view/create/edit), vendor_payments (view/create/edit), expenses
  (view/create/edit), project_documents (view/create/edit), agreements
  (view/create/edit/send), digital_approvals (view/create/edit/send),
  notifications (view), reports (view).
- **RE:** same shape but narrower — no edit on projects/vendor_bills/
  vendor_payments/expenses/project_documents/receipts (create only past that),
  agreements/digital_approvals view-only, estimates same as RM (full CRUD+send).
- **Admin-only pages** (gated by `AdminOnly` wrapper in App.js, not the permission
  matrix): Team, Approvals, Agreement Templates, Audit Log, Trash.
- **Super-admin-only** (hardcoded to `info.subhendu@gmail.com`, both client
  `SuperAdminOnly` wrapper AND server-side in the RPC): `/admin-notify` broadcast tool.
- Reports hides profit/margin figures from RM and RE (`get_reports_data` RPC is
  hierarchy-aware and role-aware — it doesn't just filter client-side).

### Data ownership/visibility hierarchy (leads/customers as the canonical example)
A lead is visible to: admin, its creator, its `assigned_to` user, anyone in
`lead_assignees` (co-assignees), OR — if you're an RM — anyone whose lead is
assigned to one of your REs (direct or via their co-assignment). Customers,
projects, receipts, agreements, digital_approvals, estimates, expenses,
vendor_bills, vendor_payments, project_documents all inherit access through
their parent (project → customer → lead chain) using the same
`private.can_access_*` helper pattern. **When adding a new table that hangs off
project/customer/lead, follow this exact pattern** rather than inventing new
access logic — grep `private.can_access_project` for the template.

## 3. Full route map (`frontend/src/App.js`)

Public (no auth): `/verify/:uid` (receipt QR verification), `/approve/:token` +
`/approve-app/:token` (digital approval public response), `/sign/:token`
(agreement public signing).

`/login` — public-only (redirects away if already signed in).

Everything else requires a session (`ProtectedRoute`), most wrapped in
`PermissionRoute resource=X` (redirects to `/` if the role can't view that
resource), inside `DashboardLayout` (sidebar+header shell) except the two print
routes (`/receipts/:id/print`, `/agreements/:id/print`) which render standalone.

| Path | Page | Gate |
|---|---|---|
| `/` | DashboardPage | any session |
| `/profile` | ProfileSettingsPage | any session |
| `/leads` | LeadsPage | PermissionRoute leads |
| `/customers` | CustomersPage | PermissionRoute customers |
| `/estimates` | EstimatesPage | PermissionRoute estimates |
| `/receipts` | ReceiptsPage | PermissionRoute receipts |
| `/projects`, `/projects/:id` | ProjectsPage, ProjectDetailPage | PermissionRoute projects |
| `/vendors`, `/vendors/:id` | VendorsPage, VendorDetailPage | PermissionRoute vendors |
| `/digital-approvals` | DigitalApprovalsPage | PermissionRoute digital_approvals |
| `/agreements`, `/agreements/:id/edit`, `/agreements/new` | Agreements* | PermissionRoute agreements (edit/create need explicit action) |
| `/team` | TeamPage | AdminOnly |
| `/approvals` | ApprovalsPage | AdminOnly |
| `/agreement-templates` | AgreementTemplatesPage | AdminOnly |
| `/audit-log` | AuditLogPage | AdminOnly |
| `/admin-notify` | AdminNotifyPage | SuperAdminOnly (info.subhendu@gmail.com) |
| `/reports` | ReportsPage (lazy) | PermissionRoute reports |
| `/trash` | TrashPage | AdminOnly |

## 4. Database — tables (public schema, 2026-09-08)

Soft-delete convention: most tables have `deleted_at`/`deleted_by` instead of hard
delete; RLS SELECT policies generally filter `deleted_at IS NULL` (or the service
layer does); admin-only hard purge lives in Trash (`trashService.js`).

- **profiles** — id (= auth.users id), full_name, email, phone, role (enum), designation, signature_url, is_admin (bool, kept in sync with role='admin' via `sync_profile_admin_flag` trigger — check both when debugging admin access).
- **leads** — full pipeline record. `status` enum now has 10 values in the current UI flow (new, contacted, not_contacted, site_visit, floor_plan_site_info, estimate_to_be_created, estimate_given\*, need_followup, converted, lost) — \*note: `quotation_given`/`negotiation` still exist in the Postgres enum from the old flow (Postgres can't drop enum values in place) but are no longer used by the UI's `LEAD_STATUSES` source of truth in `utils/format.js`. assigned_to = primary owner; `lead_assignees` = co-assignees (many-to-many). delete_request/delete_requested_by/at = soft "request to delete" workflow for non-admins (admin approves via `/approvals`).
- **lead_assignees**, **customer_assignees** — co-assignment join tables.
- **rm_re_assignments** — rm_id, re_id, assigned_by, is_active. The org-chart table. Managed via TeamPage / `rmReService.js`. Admin-only to write.
- **customers** — converted leads. assigned_to for ownership, linked_lead_id back to source lead. Same delete_request workflow as leads.
- **projects** — customer_id, status enum (planning/in_progress/on_hold/completed/cancelled), total_value. `project_members` is an explicit ACL (independent of customer ownership) for giving specific users access to a specific project.
- **expenses** — project_id, category enum (labour/material/vendor/transport/misc), amount. **`mirror_vendor_payment_expense`** trigger auto-creates an expense row when a vendor_payment is inserted (category='vendor') — don't double-count if building project cost reports.
- **estimates** + **estimate_rooms/items/terms/notes/guides** (+ **estimate_presets_backups**) — the standalone estimator tool's data (`frontend/public/estimator.html`, static HTML, not part of the React router). Presets (rooms/items/terms/notes/guides) are global, admin-managed catalogs; `estimates` are the actual generated quotes tied to a lead.
- **receipts** — customer_id OR lead_id (nullable/either, check constraint), project_id optional, payment_purpose text, `receipt_no` auto-sequenced `SG-00001`, `receipt_uid` random 5-char for QR verification links, si_no. delete_request workflow like leads/customers (there's also `receipts_delete: is_admin()` for hard delete + separate request/cancel/admin-delete RPCs).
- **receipt_attachments** — files attached to a receipt.
- **vendors** — KYC-heavy vendor directory (GST/PAN/Aadhar/bank/UPI/docs). Admin-only SELECT on the base table — see §2.
- **vendor_directory** (view, not a table) — safe subset of `vendors` for RM/RE.
- **vendor_bills** *(added by Claude, 2026-08-29)* — what work was actually done and its value. vendor_id, project_id (nullable), title, description, amount, bill_date. One row per bill — either a single final bill (electrician-style) or many small recurring ones (weekly labor), same table either way.
- **vendor_payments** — money actually paid. `payment_type` ('advance'|'against_bill', default advance) + `bill_id` (nullable FK → vendor_bills, set null on bill delete) *(added by Claude alongside vendor_bills)* — tags every payment as either a floating advance or applied against a specific bill, which is the actual point of the feature (so "what was this ₹5,000 for" is answerable months later).
- **digital_approvals** — token-based public-response workflow (customer approves/rejects via a link, with photo/geo/IP capture), similar shape to agreements' signing flow.
- **agreements** + **agreement_templates** — full contract lifecycle: draft → sent for digital signature (token-based public link, `/sign/:token`) or marked signed-physical → signed (captures signature image, geo, IP, ID proof photos) → can be voided. Templates hold reusable clauses (jsonb) + payment schedule + category-specific specs.
- **project_documents** — general file attachments on a project (separate from agreements/approvals — see `ProjectAgreementsApprovalsPanel.jsx` "Necessary Documents" which only surfaces *signed* agreements + *approved* digital approvals, plus this general upload area).
- **notifications** — per-user, in-app bell (`NotificationBell.jsx`).
- **admin_broadcasts** — the scheduled/immediate popup announcement tool (superadmin-only), dispatched via pg_cron calling `dispatch_due_broadcasts()` on a schedule; `notification_ids` array tracks which `notifications` rows were fanned out so read/unread counts are real.
- **audit_log** — append-only, written by `audit_trigger_fn()` triggers attached to most tables (including `vendor_bills` — `trg_audit_vendor_bills`). Viewable at `/audit-log` (admin only).

## 5. Key RPC functions (Postgres, `public` schema, all SECURITY DEFINER unless noted)

- **Delete-request workflow** (leads/customers/receipts): `request_delete_lead`,
  `cancel_delete_lead`, `request_delete_customer`, `cancel_delete_customer`,
  `request_delete_receipt`, `cancel_delete_receipt`, `admin_delete_receipt`
  (admin's actual hard-delete trigger point), `notify_admins_delete_request`
  (fires a notification to admins when a non-admin requests one).
- **Public token-based flows:** `get_agreement_by_token`, `submit_agreement_signature`,
  `get_approval_by_token`, `get_approval_meta_by_token`, `submit_approval_response`,
  `verify_receipt` (powers `/verify/:uid`), `mark_agreement_expired_if_due`,
  `mark_approval_expired_if_due` (lazy-expire on read, not a cron).
- **Dashboards/reports:** `get_dashboard_data`, `get_reports_data` (both
  hierarchy-and-role-aware server-side, not just client-filtered — this is why
  RM/RE never see admin's profit numbers even if the client code had a bug).
- **Admin tools:** `admin_send_notification` (the broadcast tool's backend,
  restricted to info.subhendu@gmail.com), `dispatch_due_broadcasts` (pg_cron
  target), `run_reminder_slot` (lead follow-up reminders, pg_cron).
- **Org chart:** none needed beyond RLS on `rm_re_assignments` itself — writes go
  through the table directly, gated by `private.is_rm_re_admin()`.
- **Vendor bills:** none — `vendor_bills`/`vendor_payments` are plain CRUD through
  RLS + client `assertPermission()`, no RPC layer needed.
- **Misc:** `handle_new_user` (auth.users → profiles row on signup, trigger),
  `next_estimate_no`, `set_receipt_si_no`, `create_customer_on_lead_conversion`,
  `sync_lead_on_estimate`, `sync_lead_primary_assignee`, `sync_profile_admin_flag`,
  `mirror_vendor_payment_expense` (see §4), `is_admin`/`is_lead_assignee`/
  `is_project_creator`/`is_project_member` (lower-level helpers used inside the
  `private.can_access_*` functions).

## 6. Edge Functions (`supabase/functions/`)

- **admin-set-password** — lets an admin set another user's password (service-role
  operation, can't be done client-side); verifies the caller is admin via their
  own session token before touching anything.
- **sync-website-lead** — webhook target for the *separate* marketing-website
  Supabase project. On INSERT into that project's leads table, it POSTs here with
  a shared secret (`WEBSITE_SYNC_SECRET` header `x-sync-secret`), and this
  function creates a matching row in this app's `leads` table (parsing budget
  bands and property-type strings into this app's format). **This means leads can
  appear in the CRM without anyone here creating them — check this function before
  assuming all leads come from manual entry or CSV import.**

## 7. Frontend structure quick-reference

- `App.js` — full route table (§3).
- `contexts/AuthContext.jsx` — session + profile + role, exposes `isAdmin/isRM/isRE/isStaff` booleans and `canManageTeam/canViewAuditLog/canManageTemplates/canManageApprovals` (all just `role === 'admin'` currently, kept as named flags for readability at call sites).
- `contexts/ThemeContext.jsx` — light/dark toggle; dark mode is scoped to `.shell-dark-scope` (sidebar+header only, see git history 2026-04 for why — everything else is forced light including portaled Radix dialogs).
- `utils/permissions.js`, `hooks/usePermissions.js`, `components/auth/PermissionGate.jsx`, `components/auth/PermissionRoute.jsx` — the client permission layer (§2).
- `services/*.js` — one file per resource, thin wrappers around `supabase-js` calls (+ occasional RPC calls). Full function inventory:
  - `adminNotifyService`: fetchAllUsers, sendBroadcast, fetchMyBroadcasts
  - `agreementService`: fetchAgreements, fetchAgreementById, createAgreement, updateAgreement, softDeleteAgreement, sendForDigitalSignature, markSignedPhysical, voidAgreement, buildMergeDataFromSources, renderClauseBody, fetchAgreementByToken, submitAgreementSignature, setIdProofUrls, uploadPublicSignaturePhoto, notifyAdminsAgreementSigned
  - `agreementTemplateService`: fetchTemplates, fetchTemplateById, createTemplate, updateTemplate, softDeleteTemplate, emptyClause
  - `attachmentService`: uploadFile, deleteFile
  - `auditService`: fetchAuditLog
  - `customerService`: fetchCustomers, createCustomer, updateCustomer, addCustomerAssignee, removeCustomerAssignee, requestDeleteCustomer, cancelDeleteCustomer, adminDeleteCustomer, fetchCustomerById
  - `dashboardService`: fetchDashboardData
  - `digitalApprovalService`: fetchApprovals, createApproval, updateApproval, softDeleteApproval, fetchApprovalByToken, submitApprovalResponse, uploadPublicResponsePhoto
  - `estimateService`: buildEstimatorUrl, fetchEstimates, fetchEstimateById, updateEstimateStatus, deleteEstimate, duplicateEstimate
  - `exportService`: exportAllToZip
  - `leadActivityService`: fetchLeadActivities, addLeadActivity
  - `leadPaymentService`: fetchLeadPaymentTotals (pre-conversion receipts against a lead)
  - `leadService`: fetchLeads, addLeadAssignee, removeLeadAssignee, bulkAddCoAssignee, createLead, updateLead, bulkUpdateLeads, bulkInsertLeads, updateLeadStatus, requestDelete, cancelDeleteRequest, adminDeleteLead, convertLeadToCustomer
  - `notificationService`: fetchNotifications, unreadCount, markRead, markAllRead, pushToAllAdmins
  - `profileService`: fetchProfiles, updateProfileRole, updateProfile, uploadSignature, changeOwnPassword, adminSetUserPassword
  - `projectDocumentService`: fetchProjectDocuments, uploadProjectDocument, deleteProjectDocument
  - `projectService`: fetchProjects, fetchProjectById, createProject, updateProject, deleteProject, fetchProjectMembers, addProjectMember, removeProjectMember, fetchExpensesByProject, createExpense, deleteExpense
  - `receiptService`: fetchReceipts, updateReceipt, requestDeleteReceipt, cancelDeleteReceipt, adminDeleteReceipt, deleteReceipt, fetchReceiptAttachments, fetchReceiptAttachmentsPublic, addReceiptAttachment, removeReceiptAttachment, fetchReceiptsByCustomer, fetchReceiptById, createReceipt
  - `reportService`: fetchReportsData
  - `rmReService`: fetchRmReAssignments, assignReToRm, removeReFromRm
  - `trashService`: TRASH_ENTITIES (registry of every soft-deletable table + its label/select), listTrash, restoreItem, restoreMany, purgeItem, purgeMany
  - `vendorService`: fetchVendors, fetchVendorById, createVendor, updateVendor, deleteVendor, uploadVendorDoc, fetchVendorPayments, createVendorPayment, deleteVendorPayment, fetchVendorBills, createVendorBill, deleteVendorBill (role-branches internally, see §2)
- `pages/*.jsx` — one per route, listed in §3.
- `components/{leads,projects,vendors,shared,layout,auth,ui}/` — leads/projects/vendors have feature-specific components; `ui/` is the shadcn/ui primitive library (don't hand-edit these, they're generated); `shared/` has cross-feature pieces (SearchableSelect, StatusBadge, AgreementDocument, LocationMapTile).

## 8. Things that will bite you if you forget them

- **New table hanging off project/customer/lead?** Write RLS using the
  `private.can_access_project/customer/lead` pattern, not a fresh `true`-based
  policy — a permissive `true` policy (like this doc's author originally wrote
  for `vendor_bills`) gets silently tightened later to match the hierarchy model,
  so save the rework and match it from the start.
- **New vendor-adjacent feature?** Decide admin-only vs RM/RE-safe fields up
  front; RM/RE never see the `vendors` table directly, only `vendor_directory`.
- **Permission matrix and RLS must be updated together.** The client matrix
  (`utils/permissions.js`) controls what's *shown*; RLS controls what's
  *possible*. A mismatch means either a dead button (matrix says yes, RLS says
  no) or an exposed one (matrix says no but nothing stops a direct API call —
  though RLS is the real backstop either way).
- **Postgres enums can't drop values** — `lead_status` still contains
  `quotation_given`/`negotiation` from the old pipeline even though the UI
  moved to a 10-stage flow. Harmless, just don't be surprised finding them.
- **`mirror_vendor_payment_expense`** auto-creates an `expenses` row for every
  vendor payment — any project-cost report summing `expenses` will already
  include vendor payments; don't add vendor_payments on top or it double-counts.
- **Leads can arrive from three places:** manual entry, CSV bulk import
  (`bulkInsertLeads`), or the website sync Edge Function — don't assume a lead
  with no visible creator activity is a data-entry mistake.
- **The estimator (`frontend/public/estimator.html`) is a standalone static HTML
  tool**, not a React page — it's served as a static file and manipulated with
  vanilla JS/DOM, deliberately separate from the router. Edits there use
  `node --check` on extracted script blocks to verify syntax, not the CRA build.
