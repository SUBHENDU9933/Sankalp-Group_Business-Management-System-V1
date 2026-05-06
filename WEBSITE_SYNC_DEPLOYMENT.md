# 🔄 Website → BM App — Lead Auto-Sync Deployment Guide

This sets up a **real-time pipeline** so every lead submitted on your public website is auto-pushed into the BM App CRM, deduplicated, and tagged.

**You have TWO Supabase projects:**
- **Project A — Website Supabase** (where your public site stores form submissions)
- **Project B — BM App Supabase** (`https://tbfzxmbvzpszjldupycy.supabase.co` — this CRM)

The Edge Function lives on **Project B**. A Database Webhook on **Project A** fires it on each new insert.

---

## STEP 1️⃣ — Apply v11 SQL migration on BM App Supabase (Project B)

1. Open **Project B** → SQL Editor → **New query**
2. Paste the contents of `/app/supabase_schema_v11.sql`:

```sql
alter table public.leads add column if not exists tag text;
create index if not exists idx_leads_tag on public.leads(tag) where tag is not null;
notify pgrst, 'reload schema';
```

3. Click **RUN**. You should see `Success. No rows returned.`

✅ Done when: `leads` table now has a `tag` column.

---

## STEP 2️⃣ — Install Supabase CLI (one-time, on your local computer)

Open a terminal on your **local machine** (not on this agent — Edge Functions need your auth):

### Mac:
```bash
brew install supabase/tap/supabase
```

### Windows (PowerShell):
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Linux:
```bash
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

Verify:
```bash
supabase --version
```

---

## STEP 3️⃣ — Login to Supabase CLI

```bash
supabase login
```
(opens browser → authorize → paste token back in terminal)

---

## STEP 4️⃣ — Pull the Edge Function files from this project

On your local machine, create a folder and copy the function file:

```bash
mkdir -p ~/sankalp-sync/supabase/functions/sync-website-lead
cd ~/sankalp-sync
```

Now copy the file `/app/supabase/functions/sync-website-lead/index.ts` from this Emergent workspace into:
```
~/sankalp-sync/supabase/functions/sync-website-lead/index.ts
```

👉 **Easiest way**: In Emergent chat, click **"Save to GitHub"**, then `git clone` your repo on your local machine — the file will be in `supabase/functions/sync-website-lead/index.ts`.

---

## STEP 5️⃣ — Link your local folder to BM App Supabase (Project B)

```bash
cd ~/sankalp-sync
supabase link --project-ref tbfzxmbvzpszjldupycy
```
(It will ask for the **database password** of Project B — get it from Project B → Settings → Database.)

---

## STEP 6️⃣ — Set the shared-secret Edge Function secret

Pick any long random string (this protects the endpoint from the public internet). Example: `sankalp-website-2026-xyz789`

```bash
supabase secrets set WEBSITE_SYNC_SECRET=sankalp-website-2026-xyz789 --project-ref tbfzxmbvzpszjldupycy
```

⚠️ **Save this secret** — you'll paste it into Project A in Step 8.

*(Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase — no need to set them.)*

---

## STEP 7️⃣ — Deploy the Edge Function

```bash
supabase functions deploy sync-website-lead --project-ref tbfzxmbvzpszjldupycy
```

Expected output:
```
Deployed Function sync-website-lead on project tbfzxmbvzpszjldupycy
Function URL: https://tbfzxmbvzpszjldupycy.supabase.co/functions/v1/sync-website-lead
```

📝 **Copy that Function URL** — you'll need it in Step 8.

### Quick test (optional but recommended):
```bash
curl -X POST "https://tbfzxmbvzpszjldupycy.supabase.co/functions/v1/sync-website-lead" \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: sankalp-website-2026-xyz789" \
  -d '{"record": {"name":"Test Sync","phone":"9999999999","email":"t@t.com","property_type":"2BHK Flat","budget":"₹12-20 Lakhs","message":"Test enquiry","location":"Kolkata","source":"website"}}'
```
Expected response:
```json
{"inserted":true,"id":"...","is_repeat":false,"tag":"Website Direct Enquiry"}
```
➡️ Check your **BM App → Leads page** — you should see a new lead `Test Sync` with the `Website Direct Enquiry` tag. Delete it after verification.

---

## STEP 8️⃣ — Configure Database Webhook on **Website Supabase (Project A)**

1. Open **Project A** (your website's Supabase) → **Database** → **Webhooks** → **Create a new hook**
2. Fill in exactly:

| Field | Value |
|---|---|
| **Name** | `sync-to-bm-app` |
| **Table** | `leads` *(or whatever your website form inserts into — adjust if named differently)* |
| **Events** | ✅ Insert (leave Update/Delete unchecked) |
| **Type** | `HTTP Request` |
| **Method** | `POST` |
| **URL** | `https://tbfzxmbvzpszjldupycy.supabase.co/functions/v1/sync-website-lead` |
| **HTTP Headers** | Add two rows: |
| | `Content-Type` → `application/json` |
| | `x-sync-secret` → `sankalp-website-2026-xyz789` *(the secret from Step 6)* |
| **HTTP Params** | *(leave empty)* |

3. Click **Create webhook**.

---

## STEP 9️⃣ — End-to-end test

1. Go to your **public website**, fill the contact form, submit.
2. Within ~2 seconds, open **BM App → Leads** → you should see a new row with:
   - Source: `Website`
   - Tag: `Website Direct Enquiry` (or `Website · Repeat` if the phone already existed)
   - Assigned To: *(unassigned — any RM can claim)*
   - Reminder note auto-populated with email, budget band, and page source.

3. Submit the **same phone number again** → it should appear with tag `Website · Repeat` and priority `hot`.

---

## 🎯 What This Gives You

| Scenario | Behaviour |
|---|---|
| First-time enquiry from website | New lead, tag `Website Direct Enquiry`, unassigned |
| Same phone enquires again | New lead, tag `Website · Repeat`, priority = Hot, reminder note shows date of prior lead |
| Email/budget/page info | Preserved in `reminder_note` (visible in Lead Detail drawer) |
| Budget band (`₹12-20 Lakhs`) | Auto-converted to numeric midpoint (16,00,000) |
| Property type (`2BHK Flat`) | Auto-mapped to project_type `2BHK` |

---

## 🛠️ Troubleshooting

- **Webhook shows 401 Unauthorized** → secret mismatch. Re-set `WEBSITE_SYNC_SECRET` (Step 6) and re-save the webhook header (Step 8).
- **Webhook shows 500** → open Project B → Edge Functions → `sync-website-lead` → Logs. Most common: website table column names differ from `name/phone/email/property_type/budget/message/location` — tell me your actual columns and I'll adjust the function.
- **Lead doesn't appear** → verify webhook event is `INSERT` and table name matches. Test directly with the curl in Step 7.
- **Want to remove a tag later** → `update leads set tag=null where id='...'` — zero impact on existing flows.

---

## 📌 Next Phase (Optional Upgrades I Can Build When You're Ready)

- Orange "Website" chip + red "Repeat" chip in Leads table row (visual highlight)
- Filter dropdown: "Show only website leads"
- Dashboard KPI: "Website leads this month" with trend arrow
- Auto-WhatsApp the assigned RM when a website lead is claimed
