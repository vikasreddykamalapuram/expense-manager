# MoneyIQ — Architecture & Context (agent primer)

> **Read this first.** It gives you the whole app in one compact file so you don't have to scan the
> codebase to get oriented. Diagrams over prose on purpose. Deep-dive into `src/` only when a task needs it.

**Purpose:** A **local-first, private-by-default** personal-finance manager for India. Everything works
offline on-device; optional **end-to-end-encrypted** sync mirrors data across the user's own devices.
No ads, no subscription, no data mining. Shipped as a PWA (GitHub Pages) and an Android app (Capacitor).

**Stack:** React 18 + TypeScript (strict) · Vite · Tailwind · Dexie (IndexedDB) · Capacitor (Android) ·
Supabase (optional sync backend) · Recharts · Vitest. State = React Context + `useReducer`.

## Feature map
```mermaid
mindmap
  root((MoneyIQ))
    Money in/out
      transactions
      accounts (bank/card/loan)
      categories (hierarchical)
      recurring (auto-schedule)
      reminders (bill push notifs)
    Understand
      dashboard
      analytics (6 views)
      reports (monthly)
      insights (anomalies, hidden subs)
      health (score)
      assistant (NLP EN/HI)
    Wealth
      stocks (NSE holdings, P&L)
      savings (goals)
    Shared
      splitwise (groups/expenses)
    Data in/out
      import (CSV, bank PDF, broker XLSX)
      settings (theme, security, sync, backup)
    Auth
      Google / Microsoft OAuth
```

## Layered architecture
```mermaid
flowchart TD
  subgraph Shell["Capacitor Android shell (moneyiq:// deep links, widget, biometrics)"]
    UI["React UI — src/features/*, src/app router"]
  end
  UI --> CTX["AppContext (Context + useReducer) — src/context"]
  CTX --> REPO["Repository / services — src/shared/services/*"]
  REPO --> DEXIE[("Dexie / IndexedDB\n'MoneyIQDatabase' — local source of truth")]
  REPO -. "optional, only when signed in" .-> SYNC["Supabase sync (E2E encrypted)"]
  SYNC <--> SUPA[("Supabase Postgres\nrow-level security per user")]
  PRICES["GitHub Actions (5×/day)"] --> PJSON["public/prices.json"]
  REPO --> PJSON
```
**Rule of thumb:** UI never touches storage directly → always go through a service in
`src/shared/services/`. Local Dexie is the source of truth; the network is an optional mirror.

## Sync flow (local-first + E2E encrypted)
```mermaid
sequenceDiagram
  participant D as Device (Dexie)
  participant E as encryptionService (AES-256-GCM)
  participant S as Supabase (ciphertext only)
  D->>D: user edits → write locally (instant)
  D->>E: build delta (upserted/deleted rows)
  E->>S: push encrypted delta (key never leaves device)
  S-->>E: pull peers' encrypted deltas
  E->>D: decrypt + merge (last-writer-wins by updatedAt)
```

## Data model (Dexie, all rows scoped by `profileId` for multi-profile)
`transactions` · `accounts` · `categories` · `budgets` · `recurringRules` · `receipts` ·
`stockTransactions` · `billReminders` · `splitGroups`/`splitMembers`/`splitExpenses` · `profiles` ·
`settings` · `customInstitutions` · `migrations`. Compound indexes on `[profileId+updatedAt]` power sync deltas.

## Directory map
```
src/
  app/         # router, shell bootstrap
  context/     # AppContext (global state via useReducer)
  features/    # 18 feature folders (accounts, analytics, assistant, auth, budgets,
               #   categories, dashboard, health, import, insights, recurring,
               #   reminders, reports, savings, settings, splitwise, stocks, transactions)
  shared/
    components/ services/ hooks/ context/ types/ config/ utils/
  test/        # Vitest (encryption, auth, parsers, projections)
```

## Golden rules (do NOT break)
- **Never rename these identifiers** (they map to persisted data / OS integration):
  IndexedDB name `MoneyIQDatabase`, `moneyiq_*` storage keys, the `moneyiq://` deep-link scheme,
  `moneyiq-*` sync/backup filenames. The release keystore alias stays `expenseiq`.
- **Privacy:** financial data is never shared with third parties; cloud rows are E2E encrypted; the
  developer cannot read them. Don't add analytics on financial content.
- **Conventions:** TypeScript strict (no `any`), functional components, Tailwind only, repository
  pattern for data. Tests with Vitest. See `AGENTS.md` + `CONTRIBUTING.md`.
