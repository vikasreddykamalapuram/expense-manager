# ExpenseIQ — Personal Finance Manager

> A modern, feature-rich expense tracking web application built with React, TypeScript, and Tailwind CSS.

## 🎯 Vision

Build a comprehensive personal finance manager that helps users track income and expenses, visualize spending patterns, and make informed financial decisions. Starting as a web app with plans to extend to Android and iOS.

## ✨ Features

### Core
- **Dashboard** — overview with summary cards, monthly trend chart, expense breakdown pie chart, recent transactions
- **Add Transaction** — record income/expense with category, date, notes, and recurring option
- **Transaction List** — searchable, filterable, sortable list with inline edit and delete
- **Monthly View** — month-by-month breakdown with category analysis and previous month comparison
- **Settings** — currency selection, date format, data export/import, clear data

### Categories
**Expenses:** Food & Dining, Groceries, Transportation, Shopping, Entertainment, Bills & Utilities, Health & Medical, Education, Travel, Rent/Mortgage, Insurance, Personal Care, Gifts & Donations, Subscriptions, Other

**Income:** Salary, Freelance, Investments, Rental Income, Business, Side Hustle, Gifts Received, Refunds, Interest, Other

### Data Management
- Local storage persistence (browser-based)
- JSON export/import for backup and portability
- Data versioning for safe migrations
- Repository pattern for easy backend swap

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Routing | React Router v6 |
| State | React Context + useReducer |
| Icons | Lucide React |
| Storage | localStorage (swappable) |

## 📁 Project Structure

```
expense-manager/
├── src/
│   ├── app/                    # App-level config (router)
│   ├── context/                # React Context providers
│   ├── features/               # Feature-based modules
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── monthly/
│   │   ├── budgets/
│   │   └── settings/
│   └── shared/                 # Shared code
│       ├── components/         # Reusable UI components
│       │   └── ui/            # Button, Input, Modal, etc.
│       ├── constants/         # Categories, currencies
│       ├── hooks/             # Custom React hooks
│       ├── services/          # Storage service (repository)
│       ├── types/             # TypeScript interfaces
│       └── utils/             # Helpers (format, date, etc.)
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🚀 Getting Started

```bash
cd expense-manager
npm install
npm run dev
```

## 🗺 Roadmap

### Phase 1 — Web MVP ✅
- [x] Dashboard with charts
- [x] Add/Edit/Delete transactions
- [x] Transaction filtering and search
- [x] Monthly view with comparisons
- [x] Settings and data export/import
- [x] Category system
- [x] Recurring transactions flag

### Phase 2 — Enhanced Features
- [ ] Budget management per category/month
- [ ] Custom category creation UI
- [ ] Dark mode theme
- [ ] PWA support (offline + install)
- [ ] Advanced analytics (trends, predictions)
- [ ] CSV import from bank statements

### Phase 3 — Backend Integration
- [ ] Express.js / Node.js API server
- [ ] SQLite / PostgreSQL database
- [ ] User authentication
- [ ] Multi-device sync

### Phase 4 — Mobile App
- [ ] React Native or Flutter
- [ ] Android + iOS apps
- [ ] Push notifications for budgets
- [ ] Camera receipt scanning

## 🏗 Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management | Context + useReducer | Sufficient for single-user app |
| Storage | localStorage | Simple MVP; behind repository pattern for easy swap |
| Directory structure | Feature-based | Scales better than type-based |
| Category IDs | Stable string IDs | Protects historical data |
| Styling | Tailwind CSS | Utility-first, consistent design system |

## 📄 License

Private — Personal Use

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
