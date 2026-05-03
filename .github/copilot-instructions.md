# Personal Projects — Copilot Instructions

## Scope
This workspace contains personal side projects, completely separate from official Microsoft work (MCH/HDS/HARS). All projects live under `D:\Repos\Personal_Projects\`.

## Projects
| Project | Directory | Status | Live URL |
|---------|-----------|--------|----------|
| ExpenseIQ | `expense-manager/` | Active — Production | https://vikasreddykamalapuram.github.io/expense-manager/ |

---

## ExpenseIQ — Personal Finance Manager

### Tech Stack
- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS
- **Database:** IndexedDB via Dexie.js v5 (local-first, no backend server)
- **Auth:** Google OAuth (popup mode) + Microsoft OAuth — session persisted in localStorage
- **PWA:** Installable on Android/iOS/Desktop with offline support (Workbox)
- **Hosting:** GitHub Pages (free) — repo `vikasreddykamalapuram/expense-manager`
- **Charts:** Recharts for analytics visualizations
- **PDF:** pdf.js for bank statement parsing
- **XLSX:** SheetJS for Excel import/export

### Architecture
```
expense-manager/
├── src/
│   ├── features/          # Feature-based modules
│   │   ├── accounts/      # Bank accounts, credit cards, loans
│   │   ├── analytics/     # 6-view analytics (overview, category, trend, income-vs-expense, budget, comparison)
│   │   ├── assistant/     # AI chat assistant with NLP (English + Hindi)
│   │   ├── budgets/       # Monthly budget tracking per category
│   │   ├── categories/    # Categories + subcategories (hierarchical)
│   │   ├── dashboard/     # Main dashboard with stats
│   │   ├── health/        # Financial health score
│   │   ├── import/        # CSV import, bank statement PDF parser, trade import
│   │   ├── recurring/     # Recurring transactions engine
│   │   ├── reminders/     # Bill reminders with push notifications
│   │   ├── reports/       # Monthly financial reports
│   │   ├── settings/      # Settings, theming, data management, auth
│   │   ├── stocks/        # Stock portfolio (holdings, P&L, trade history)
│   │   └── transactions/  # Add/edit/list transactions
│   ├── shared/
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React context (AppContext with useReducer)
│   │   ├── services/      # DB service (Dexie), stock services, encryption
│   │   └── types/         # TypeScript interfaces
│   └── test/              # Test files (Vitest)
├── public/                # Static assets, icons, manifest
└── dist/                  # Build output
```

### Key Features Implemented (as of May 2026)
1. **Transactions** — Add income/expense/transfer with categories, subcategories, accounts, notes
2. **Accounts** — Bank accounts, credit cards, loans with balance tracking
3. **Categories** — Hierarchical categories with subcategories, custom icons
4. **Analytics** — 6 view modes: overview, category breakdown, trends, income-vs-expense, budget comparison, period comparison
5. **Budgets** — Monthly budgets per category with overspend alerts
6. **Reports** — Monthly financial summary reports
7. **Recurring Transactions** — Auto-generate recurring income/expenses
8. **Bill Reminders** — Push notifications for upcoming bills, EMIs, subscriptions
9. **Smart Auto-Categorization** — Learns from past transactions to suggest categories
10. **AI Assistant** — NLP chat (English + Hindi) for financial queries
11. **Stock Portfolio** — Import trades (Geojit Excel), track holdings, P&L, trade history
12. **CSV Import/Export** — Import from other expense trackers, export data
13. **PDF Bank Statement Parser** — X-coordinate column mapping, password-protected PDFs
14. **Cloud Backup** — Google Drive / OneDrive backup (OAuth-based)
15. **PWA** — Installable, offline-capable, iOS smart install banner
16. **Security** — CSP headers, XSS sanitization (DOMPurify), encrypted sensitive data (Web Crypto API), JWT validation, auth rate limiting
17. **Theming** — Light/Dark/System + 10 accent colors (Indigo, Magenta, Teal, etc.) + AMOLED black mode
18. **Code Splitting** — 16 lazy-loaded routes, 6 vendor chunks (total ~2.1MB → fast initial load)
19. **Financial Health Score** — Dashboard scoring finances across multiple dimensions

### Dexie DB Schema (v5)
- v1: transactions, categories, accounts, settings
- v2: + recurringRules
- v3: + receipts
- v4: + stockTransactions
- v5: + billReminders

### Deploy Workflow
- **Source repo:** `D:\Repos\Personal_Projects\expense-manager` (development)
- **Deploy repo:** `D:\Repos\Personal_Projects\expense-manager-deploy` (built output)
  - Has its own `.git` pointing to `https://github.com/vikasreddykamalapuram/expense-manager.git`
  - GitHub Pages serves from `master` branch root
- **Process:**
  1. `cd expense-manager && npm run build`
  2. `robocopy dist ../expense-manager-deploy /MIR` (excluding `.git`, `node_modules`, etc.)
  3. `cd ../expense-manager-deploy && git checkout -- .github/workflows/deploy.yml` (preserve workflow)
  4. `git add -A && git commit && git push`
- **Commit authoring:** `vikasreddykamalapuram <vikasreddykamalapuram@gmail.com>` — NO Co-authored-by Copilot trailer
- **Build:** `npm run build` (= `tsc -b && vite build`)
- **Test:** `npx vitest run` (12 tests: encryption + auth)

### Pending / Next Features (Parked for Later)
| Priority | Feature | Notes |
|----------|---------|-------|
| 🔴 High | Live Stock Prices | No free Indian stock API supports browser-direct access (CORS). Need server-side fetch. GitHub Action approach prototyped but reverted. See "Stock Price Discovery Notes" below. |
| 🟡 Medium | Portfolio Analytics | P&L charts, diversification pie, sector breakdown |
| 🟡 Medium | Google Search Console Verification | App not indexed — needs domain verification + sitemap |
| 🟢 Low | Custom Domain (.in) | Deferred — will set up when going fully public |
| 🟢 Low | Android/iOS Mobile App | Future phase — React Native or Capacitor |

### Stock Price Discovery Notes (IMPORTANT — Read Before Resuming)
**Problem:** Need live Indian stock prices (NSE/BSE) in a browser-only PWA.

**What was tried & why it failed:**
1. **Yahoo Finance v8 API** — Works server-side, CORS-blocked from browser ❌
2. **NSE India API** — Works server-side with cookies, CORS-blocked ❌
3. **Twelve Data API** (free plan) — Returns 403 for ALL Indian stocks, requires paid "Grow" plan ($29/mo) ❌
4. **Zerodha Kite Connect** — Free plan has NO market data, paid ₹500-2000/mo, NO CORS ❌
5. **CORS proxies** (allorigins, corsproxy, codetabs) — Down, blocked by corporate IT, or rate-limited ❌
6. **CSP blocker** — `index.html` line 6 has strict `connect-src` that blocks ALL external API calls from browser

**Prototype built but reverted:**
- GitHub Action (`update-prices.yml`) runs every 15 min during market hours
- `scripts/fetch-prices.mjs` fetches Yahoo Finance server-side → outputs `prices.json`
- App reads `prices.json` from same-origin (no CORS)
- 47/51 symbols worked. **Reverted** because force-push to deploy repo wiped commit history.
- Source code for the prototype is in git reflog (commits `175f3fa`, `8fc9005`, `18d6694`)

**Yahoo Finance symbol quirks discovered:**
- `BAJFINSERV` → `BAJAJFINSV` on Yahoo
- `ZOMATO` → `ETERNAL` on Yahoo (rebranded 2025)
- `HBLPOWER` → `HBLENGINE` on Yahoo
- `TATAMOTORS` → temporarily unavailable (404)
- `VEDL` → `chartPreviousClose` is wrong post-demerger (use `regularMarketPreviousClose`)

**Recommended approach when resuming:**
1. Carefully set up deploy repo's `.git` FIRST (don't re-init, just add remote)
2. Use the GitHub Action approach (static `prices.json`)
3. Merge price update workflow with existing deploy workflow to avoid conflicts
4. Test locally with `node scripts/fetch-prices.mjs` before pushing

### Known Issues
- Stock prices show as "unavailable" (feature exists but no live data source)
- VEDL previousClose unreliable post-demerger
- TATAMOTORS not available on Yahoo Finance

---

## General Rules
- Use TypeScript for all projects unless explicitly stated otherwise
- Follow feature-based directory structure within each project
- Write production-ready code: proper error handling, accessibility, type safety
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Keep dependencies minimal and well-justified
- All components should be functional (React hooks, no class components)
- Prefer composition over inheritance
- Write self-documenting code; add comments only for non-obvious logic

## Code Style
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **React:** functional components, named exports, props interfaces
- **CSS:** Tailwind CSS utility-first, extract components for repeated patterns
- **Naming:** PascalCase for components, camelCase for functions/variables, UPPER_SNAKE for constants
- **Files:** one component per file, index.ts for barrel exports

## Custom Agents
Specialized agents are available in the `agents/` directory:
- **planner** — breaks down features into tasks, creates implementation plans
- **coder** — writes production code following project conventions
- **tester** — writes and runs tests, validates coverage
- **reviewer** — reviews code for quality, patterns, and potential issues
- **security-auditor** — audits for vulnerabilities, XSS, CSRF, injection risks

## Testing
- Unit tests with Vitest + React Testing Library
- Test files in `src/test/`: `encryption.test.ts` (5 tests), `auth.test.tsx` (7 tests)
- Aim for meaningful coverage, not 100% line coverage
- Test behavior, not implementation details

## Git Workflow
- `master` branch is always deployable
- Feature branches: `feature/<name>`
- Bug fixes: `fix/<name>`
- Always commit with descriptive messages
- **CRITICAL:** Never force-push to the deploy repo without verifying history is preserved
