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
20. **Cross-Device Sync** — E2E encrypted (AES-256-GCM) sync via Google Drive / OneDrive delta sync
21. **Live Stock Prices** — GitHub Actions fetches Yahoo Finance every 90 min during market hours → static prices.json
22. **ISIN-Based Symbol Resolution** — Official NSE EQUITY_L.csv (2,130 stocks) for broker import symbol→ticker mapping

### Dexie DB Schema (v6)
- v1: transactions, categories, accounts, settings
- v2: + recurringRules
- v3: + receipts
- v4: + stockTransactions
- v5: + billReminders
- v6: + updatedAt compound indexes for sync delta queries
- Runtime migration v2: fixes stock symbols + names using official NSE ISIN data

### Deploy Workflow
- **Source repo:** `D:\Repos\Personal_Projects\expense-manager` (development)
- **GitHub:** `vikasreddykamalapuram/expense-manager` (master branch)
- **Deploy:** GitHub Actions workflow at `.github/workflows/deploy.yml` (uses `working-directory: expense-manager`)
- **Stock prices:** GitHub Actions workflow at `.github/workflows/update-prices.yml` (5 cron runs/day during IST market hours)
- **Commit authoring:** `vikasreddykamalapuram <vikasreddykamalapuram@gmail.com>` — NO Co-authored-by Copilot trailer
- **Build:** `npm run build` (= `tsc -b && vite build`)
- **Test:** `npx vitest run` (12 tests: encryption + auth)

### Pending / Next Features (Parked for Later)
| Priority | Feature | Notes |
|----------|---------|-------|
| 🟡 Medium | Verify stock prices post-migration | Check that migration v2 fixed symbol/name associations correctly on live site |
| 🟡 Medium | Portfolio Analytics | P&L charts, diversification pie, sector breakdown |
| 🟡 Medium | Google Search Console Verification | App not indexed — needs domain verification + sitemap |
| 🟢 Low | Custom Domain (.in) | Deferred — will set up when going fully public |
| 🟢 Low | Android/iOS Mobile App | Future phase — React Native or Capacitor |

### Stock Prices — Current Architecture (IMPLEMENTED)
**Solution:** GitHub Actions → static `prices.json` → same-origin fetch (zero CORS issues)

**How it works:**
1. `.github/workflows/update-prices.yml` runs 5x/day during IST market hours (3:45, 5:15, 6:45, 8:15, 9:45 UTC)
2. `scripts/fetch-prices.mjs` fetches Yahoo Finance v8 server-side → writes `public/prices.json`
3. App reads `prices.json` from same origin — NetworkFirst caching in service worker
4. `[skip ci]` in commit message prevents price updates from triggering deploy

**Symbol Resolution:** `scripts/generate-nse-map.mjs` fetches official NSE EQUITY_L.csv (2,130+ stocks)
- Generates `public/nse-symbol-map.json` with ISIN→ticker + name→ticker mappings
- `src/shared/services/symbolResolver.ts` uses this map at import time (ISIN-first resolution)
- Geojit DP Holdings/Transactions parsers use ISIN column for reliable symbol lookup
- Run `node scripts/generate-nse-map.mjs` monthly to capture new NSE listings

**Yahoo Finance symbol overrides** (in fetch-prices.mjs):
- `BAJFINSERV` → `BAJAJFINSV`, `ZOMATO` → `ETERNAL`, `HBLPOWER` → `HBLENGINE`, `TATAMOTORS` → `TMPV`

**Known Limitations:**
- Prices update 5x/day (not real-time) — acceptable for portfolio tracking
- Delisted stocks (RAJESH EXPORTS, GVK POWER, SWATI PROJECTS) show N/A
- GitHub Actions: unlimited minutes for public repos
- VEDL previousClose may be unreliable post-demerger (use `regularMarketPreviousClose`)

### Known Issues
- A few delisted/suspended stocks will always show N/A (user should manually manage)
- Service worker may serve stale JS bundles — users may need to close/reopen PWA after deploy

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
