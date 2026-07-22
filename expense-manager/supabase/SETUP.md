# ExpenseIQ — Supabase Setup Guide

## Step 1: Create a New Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. You should see your existing **PABS-boutique** project
3. Click **"New Project"** (top-left dropdown or home page)
4. Fill in:
   - **Name:** `expenseiq`
   - **Database Password:** (save this securely — you'll need it for direct DB access)
   - **Region:** Choose closest to you (e.g., `ap-south-1` Mumbai for India)
   - **Plan:** Free tier (sufficient for personal use)
5. Click **Create new project** — wait ~2 minutes for provisioning

## Step 2: Get Your API Credentials

1. Go to **Settings → API** (left sidebar)
2. Copy these values:
   - **Project URL:** `https://xxxxxxxxxxxx.supabase.co`
   - **anon (public) key:** `eyJhbGciOi...` (safe for frontend)
3. Create a `.env` file in `expense-manager/`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ The `.env` file is gitignored. Never commit real keys.

## Step 3: Configure Google OAuth in Supabase

1. Go to **Authentication → Providers** (left sidebar)
2. Find **Google** and enable it
3. Fill in:
   - **Client ID:** Same as your `VITE_GOOGLE_CLIENT_ID` (from Google Cloud Console)
   - **Client Secret:** From Google Cloud Console → Credentials → OAuth Client → Client Secret
4. Add Supabase callback URL to Google Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Edit your OAuth Client ID
   - Add to **Authorized redirect URIs:**
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
5. Save both in Supabase and Google Console

## Step 4: Configure Microsoft OAuth (Optional)

1. In Supabase **Authentication → Providers**, find **Azure (Microsoft)**
2. Fill in:
   - **Client ID:** Same as your `VITE_MICROSOFT_CLIENT_ID`
   - **Client Secret:** From Azure Entra ID → App Registration → Certificates & secrets
   - **URL:** `https://login.microsoftonline.com/common`
3. In Azure Portal, add redirect URI:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```

## Step 5: Run Database Migration

1. Go to **SQL Editor** (left sidebar in Supabase Dashboard)
2. Click **New Query**
3. Open `supabase/migrations/001_initial_schema.sql` from this repo
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** (or Ctrl+Enter)
6. You should see: "Success. No rows returned" — that means all tables were created

### Verify Tables Created

Go to **Table Editor** (left sidebar) — you should see 14 tables:
- `profiles`, `accounts`, `categories`, `transactions`
- `budgets`, `recurring_rules`, `stock_transactions`
- `bill_reminders`, `user_settings`, `custom_institutions`
- `split_groups`, `split_members`, `split_expenses`, `split_settlements`
- `sync_metadata`

### Verify RLS is Enabled

Each table should show a shield icon 🛡️ indicating Row Level Security is active.

## Step 6: Test the Connection

1. Start the dev server:
   ```bash
   cd expense-manager
   npm run dev
   ```
2. Open the app → **Settings** page
3. You should see the **Cloud Database** section showing "Not connected"
4. Sign in with Google/Microsoft
5. Click **Connect to Backend**
6. Status should change to "Connected" with your email shown

## Troubleshooting

### "Google auth bridge failed"
- Check that Google provider is enabled in Supabase Auth settings
- Verify the Client ID and Secret match your Google Console
- Ensure the callback URL is added to Google Console

### "No auth token found"
- Sign out and sign in again — tokens are stored per session
- The app stores ID tokens in sessionStorage during login

### Tables not showing in Table Editor
- Re-run the migration SQL — check for errors in the output
- Make sure you ran it in the correct project (not PABS-boutique)

---

## Architecture Summary

```
┌──────────────────────────────────────────────┐
│              ExpenseIQ (Browser)              │
│                                              │
│  IndexedDB (Dexie) ←→ React App ←→ UI       │
│       ↕ (delta sync)                         │
│  Supabase Client (JS SDK)                    │
└────────────┬─────────────────────────────────┘
             │ HTTPS (authenticated)
┌────────────▼─────────────────────────────────┐
│           Supabase Backend                    │
│                                              │
│  ┌─────────┐ ┌──────────┐ ┌───────────────┐ │
│  │  Auth   │ │PostgreSQL│ │  Realtime WS  │ │
│  │(Google/ │ │  (RLS)   │ │ (Phase D.4)   │ │
│  │Microsoft│ │          │ │               │ │
│  └─────────┘ └──────────┘ └───────────────┘ │
└──────────────────────────────────────────────┘
```
