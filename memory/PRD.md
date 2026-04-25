# SANKALP GROUP & BUSINESS SOLUTIONS — Business Management System v1

## Original Problem Statement
Build a scalable internal SaaS for an Interior & Infrastructure Solutions Company. 6 phases:
1. Login + Dashboard, 2. Lead Management, 3. Customer Management, 4. Receipt & Payment, 5. Project & Expense, 6. Vendor Management. Roles: admin (full access, delete approval) and rm (relationship manager). No direct deletes — admin approval workflow.

## Architecture
- **Frontend:** React 19 + Vite-style craco + TailwindCSS + Shadcn UI (`@/components/ui/*`)
- **Backend / DB:** Supabase (Postgres + Auth + RLS) — talks directly from browser using anon key
- **Auth:** Supabase Email/Password
- **Hosting target:** Vercel (frontend) + Supabase (backend)
- **The bundled FastAPI/MongoDB backend is unused** in this app.

## Supabase Project
- URL: https://tbfzxmbvzpszjldupycy.supabase.co
- 8 tables created via /app/supabase_schema.sql: profiles, leads, customers, receipts, projects, expenses, vendors, vendor_payments
- RLS enabled on all tables. SELECT/INSERT/UPDATE for authenticated; DELETE only for admin via `is_admin()` helper.
- Auto-trigger on `auth.users` insert creates a `profiles` row with role='rm' by default.

## User Personas
1. **Admin** (info.subhendu@gmail.com) — sees all data, approves/rejects delete requests, manages team roles.
2. **RM (Relationship Manager)** — manages assigned leads/customers, can request delete (cannot delete directly), can create receipts/projects/expenses.

## Core Requirements (Static)
- Lead pipeline: new → contacted → site_visit → quotation_given → negotiation → converted/lost
- Lead → Customer conversion (locks the lead, creates customer with `linked_lead_id`)
- Receipt auto-numbering: `SG-01001`, `SG-01002`, … via Postgres sequence
- Print-to-PDF receipts via browser print
- Project & Expense tracking by category (labour/material/vendor/transport/misc)
- Vendor management + Vendor payments (linkable to projects)
- Today's follow-ups + Overdue follow-ups on Dashboard
- Pending Approvals queue (admin-only)

## Implemented (2026-04-25 / Iteration 1)
- ✅ Supabase schema, RLS policies, helpers, triggers, admin seed
- ✅ Login page (Swiss/brutalist design with concrete texture hero)
- ✅ Auth context with profile loading, role gating, public/protected/admin routes
- ✅ Sidebar layout with role-aware menu (Team + Approvals only for admin)
- ✅ Dashboard with 5 KPIs + Today's & Overdue follow-ups + Recent Activity + Pending Approvals banner
- ✅ Leads page: table + kanban view, status filter, search, full CRUD via dialog
- ✅ Lead → Customer conversion + lead locking
- ✅ Delete-request flow + Approvals page (Admin Approve/Reject)
- ✅ Customers CRUD + delete-request flow
- ✅ Receipts: auto receipt_no, payment modes, full print page with amount-in-words (Indian rupee format)
- ✅ Projects + Project Detail page with expense log + receipts + P/L summary
- ✅ Vendors page (cards) + Vendor Payments tab
- ✅ Team page (admin only) — promote/demote rm↔admin
- ✅ Sonner toasts, react-hook-form, lucide-react icons, IBM Plex Sans + Cabinet Grotesk fonts
- ✅ Square corners (rounded-none) brutalist theme, stone palette + orange accent
- ✅ data-testid on all interactive elements (verified by testing agent)

## Backlog (P1)
- Pre-fill phone in DB via `idx_leads_phone_unique` to prevent duplicate leads (currently allowed)
- Add DialogDescription on dialogs to silence Radix a11y warning (cosmetic)
- Lead status history table + audit log
- Email notifications (Resend) when delete request submitted
- File uploads (estimates/agreements) — Supabase Storage

## Backlog (P2)
- Estimate & Agreement system (Phase 7 mentioned as future-ready)
- Reports / analytics dashboard (per-RM performance)
- Customer payment ledger PDF export
- Mobile-app PWA install
- Bulk import (CSV) for leads/vendors

## Deployment Notes
- Push frontend to GitHub → import in Vercel
- In Vercel project, set env vars: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` (publishable key)
- Build command: `yarn build` (or `craco build`)
- Output dir: `build`

## Test Credentials
See `/app/memory/test_credentials.md`
