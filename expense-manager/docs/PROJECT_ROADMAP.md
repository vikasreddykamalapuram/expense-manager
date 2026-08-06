# MoneyIQ — Project Roadmap & Living Context

> **Single source of truth.** Any device / IDE / agent should read this first to know
> **what's done, what's in flight, and what's next**. Update it at every milestone
> (status + PR links). Companion docs: `ARCHITECTURE.md` (how the app works),
> `docs/SALARY_AUTODETECT_DESIGN.md` (salary/tax/auto-detect detail), `AGENTS.md`, `CONTRIBUTING.md`.

_Last updated: 2026-08-06 · Repo: `vikasreddykamalapuram/expense-manager` · Package: `io.github.vikasreddykamalapuram.moneyiq`_

---

## 1. Current progress

### ✅ Shipped to `master`
| PR | Feature |
|----|---------|
| #14 | Rebrand → **MoneyIQ**, unique applicationId, Play Console onboarding fixes |
| #15/#16 | ESLint cleanup (rules-of-hooks, unused-var config, ignore generated native code) |
| #17 | UX: settings tabs wrap · reactive status bar · Add-transaction button |
| #18 | **Installments (EMI)** support |
| #19/#20 | **Quick-add** fast-entry screen (keypad + category grid) + inline create for custom categories/accounts |

### 🟡 In flight
| PR | Feature | State |
|----|---------|-------|
| **#21** | **Salary Intelligence** (A.1 breakdown · A.2 payslip PDF import · A.3 payslip history/YTD/PF/trend) | Open — under device testing (debug APK), merge after QA |

### 📋 Designed, not started
- **B** Tax regime advisor (old vs new) + 80C — see `SALARY_AUTODETECT_DESIGN.md`
- **C** Auto-detect expenses (share intent · notification listener · Gmail) — see `SALARY_AUTODETECT_DESIGN.md`
- **D** Net worth + EPF/PPF/NPS + take-home calculator
- **E** Seamless account onboarding *(designed below)*
- **F** Splitwise settle-up notifications *(designed below)*

### Play Store status
- MoneyIQ live on **Internal testing**; moving to **Closed testing** (needs 12 testers / 14 days for production access). Release via `v*.*.*` tag → `android-release.yml`. Sideload test APKs via `android-debug.yml` (`gh workflow run android-debug.yml --ref <branch>`).

---

## 2. Epic E — Seamless account onboarding  🆕

**Problem:** users must add salary/savings accounts, credit cards, pay-later, and loans with lots of
numbers (balances, CC limits, outstanding, loan principal/repaid/outstanding). Manual entry =
onboarding fatigue → churn. **Goal:** minimize typing; automate where compliant; make it feel effortless.

### Industry standards & options (best → lightest)
| Approach | What it does | Effort | Privacy/compliance |
|---|---|---|---|
| **RBI Account Aggregator (AA)** — Finvu / Setu / OneMoney / CAMS Finserv | One consent → auto-pull **balances, transactions, deposits, loans** in real time | High (become/partner as an **FIU**) | RBI-regulated, consent-based, revocable, encrypted end-to-end — the gold standard & key differentiator |
| **SMS / notification parsing** (Epic C) | Read bank balance/CC-statement alerts on-device → auto-update balances & outstanding | Medium | On-device, **opt-in**; `READ_SMS` not Play-eligible → use **notification listener** + share intent |
| **Statement/PDF import** (extend existing parser) | Import a bank/CC statement → auto-create the account with detected balance + transactions | Low–Med | On-device parse; already have `pdfStatementParser` |
| **Preset catalog** (banks / cards / pay-later) | Tap a tile (HDFC, ICICI, SBI, Axis; Amazon Pay ICICI, HDFC Millennia; LazyPay, Simpl, Paytm Postpaid, Amazon Pay Later) → pre-filled name/type/icon/typical due-date; user enters only the number | Low | No sensitive data in catalog |
| **Loan calculator (compute, don't ask)** | Ask 3–4 inputs (principal, rate, tenure, start) → **derive** EMI, repaid, outstanding, principal via amortization | Low | Pure local math — removes the most tedious inputs |
| **OCR scan** (card / sanction letter) | Scan → prefill last-4 / network / amounts | Med | On-device OCR (Tesseract.js); never store card number |
| **Progressive onboarding + smart nudges** | Don't force everything upfront; start with 1 account, then nudge ("salary credit detected — add that account?") | Low | Reduces perceived effort |

### Recommended phased plan
1. **E.1 Preset catalog + Loan calculator** *(now — biggest UX win, zero policy risk):* tap-to-add bank/card/pay-later tiles; loan wizard computes the schedule from a few inputs; progressive "add later."
2. **E.2 Statement → auto-create account** *(reuse PDF parser):* import statement → suggest an account with balance.
3. **E.3 Balance/CC auto-update via notification listener** *(part of Epic C):* opt-in on-device parsing keeps balances/outstanding fresh without manual edits.
4. **E.4 RBI Account Aggregator** *(strategic differentiator):* integrate an AA (Setu/Finvu sandbox first) for one-consent auto-pull of accounts, balances, and loans. Requires FIU onboarding + privacy-policy/Data-safety updates.

### Security & privacy
- AA: consent artefact per RBI spec, purpose-limited, time-bound, revocable; tokens/keys **server-side only**.
- Notification/SMS/statement: on-device parse, opt-in, user-confirmed, nothing raw uploaded.
- Catalog/calculator: fully local, no PII.

---

## 3. Epic F — Splitwise settle-up notifications  🆕

**Goal:** remind a person to settle up — via **push** (app users), **email** (logged-in Gmail /
any address), or **SMS** (mobile number). Mirrors Splitwise's own reminder UX.

### Channels & industry standards
| Recipient | Channel | Provider (industry standard) |
|---|---|---|
| App user | **Push** | Firebase Cloud Messaging (FCM) + in-app |
| Anyone (email) | **Transactional email** | Resend / SendGrid / AWS SES — sent from a **Supabase Edge Function** |
| Anyone (mobile) | **SMS** | **India:** MSG91 / Gupshup (DLT-registered templates); global: Twilio / AWS SNS |

### Architecture (secure by design)
```mermaid
flowchart LR
  U[User taps "Remind"] --> APP[MoneyIQ client]
  APP -->|authenticated call| EF[Supabase Edge Function<br/>holds provider keys]
  EF -->|FCM| PUSH[App user push]
  EF -->|Resend/SES| MAIL[Email]
  EF -->|MSG91/Twilio| SMS[SMS]
```
- **Never** put email/SMS provider API keys in the client — they live in the **Supabase Edge Function** (or serverless) as secrets.
- Settle-up message includes amount, who owes whom, and a **deep link** (`moneyiq://…` / web) to the group.
- **Rate-limit** reminders (e.g., max 1/day/person); **consent + unsubscribe**; store minimal contact PII; log deliveries.
- **India SMS:** requires **DLT registration** + approved templates (transactional route). Email needs SPF/DKIM on the sending domain.
- Update **privacy policy + Play Data safety** when contact data is used to notify.

### Phased plan
1. **F.1 In-app + FCM push** for app users (lightest, no PII of third parties).
2. **F.2 Email reminders** via Supabase Edge Function + Resend/SES (works for the logged-in Gmail and any address).
3. **F.3 SMS reminders** via MSG91/Twilio (after DLT for India).

---

## 4. Global security & privacy principles (all epics)
- **Local-first, on-device** parsing/compute; raw financial text/files never uploaded.
- **Opt-in** per data source (notifications, AA, contacts) with clear disclosure + easy revoke.
- Secrets (email/SMS/AA provider keys) live **server-side only** (Supabase Edge Functions).
- Cloud sync stays **E2E-encrypted**; sensitive numbers in the encrypted local DB.
- Keep `PRIVACY_POLICY`, `public/privacy-policy.html`, and Play **Data safety** in sync with every new data source.

## 5. Suggested execution order
1. Merge **#21** (Salary) after QA.
2. **E.1** Preset catalog + loan calculator (fast onboarding win).
3. **B** Tax advisor (builds on salary).
4. **C** Auto-detect (share → notification listener → Gmail) → unlocks **E.3** balance auto-update.
5. **F.1/F.2** Splitwise push + email reminders.
6. **D** Net worth; **E.4** Account Aggregator; **F.3** SMS.

## 6. How to resume (any device / agent)
1. Read this file + `ARCHITECTURE.md`.
2. Check open PRs (`gh pr list`) and this doc's status tables.
3. Pick the next item from §5, branch as `vrk/<context>` (see `CONTRIBUTING.md`), implement, validate
   (`tsc -b` · `npm run lint` · `npx vitest run` · `npm run build:capacitor`), PR to `master`.
4. **Update this file** (status + PR) so nothing is lost.
