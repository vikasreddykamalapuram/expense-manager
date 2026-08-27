# MoneyIQ — Project Roadmap & Living Context

> **Single source of truth.** Any device / IDE / agent should read this first to know
> **what's done, what's in flight, and what's next**. Update it at every milestone
> (status + PR links). Companion docs: `ARCHITECTURE.md` (how the app works),
> `docs/SALARY_AUTODETECT_DESIGN.md` (salary/tax/auto-detect detail), `AGENTS.md`, `CONTRIBUTING.md`.

_Last updated: 2026-08-22 · Repo: `vikasreddykamalapuram/expense-manager` · Package: `io.github.vikasreddykamalapuram.moneyiq`_

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
| #21 | **Salary Intelligence** (A.1 breakdown · A.2 payslip PDF import · A.3 payslip history/YTD/PF/trend) |
| #22 | PROJECT_ROADMAP living tracker + Epic E/F designs |
| #23 | **Target Android SDK 36 (Android 16)** + Pages deploy fix |
| #24 | **E.1** preset account catalog + loan calculator · **Epic G** first-run setup wizard |
| #25 | **Epic B** Tax Regime Advisor (old vs new) + 80C tracker |
| #26 | **Epic C** Auto-detect: C.1 share/review-queue · C.2 notification listener (native) · C.3 Gmail read-only + Data Safety/Privacy docs |
| #27 | **Epic D** Net worth + EPF/PPF/NPS holdings + take-home calculator |
| #28 | **Onboarding v2** — personas, batch account/category add |
| #29 | **E.2/E.3** Budget intelligence + statement→account + balance auto-update |
| #30 | Auto-detect: notification captures persist across process death (SharedPreferences, not in-memory) |
| #31 | **Receipt scanner** (camera/gallery → OCR → parsed transaction review) |
| #32 | **CSP fix** — unblocked OCR (WASM) and the Gmail API host |
| #33 | **Android Kotlin compilation fix** + APK artifact verification guard *(see below — this one is important)* |

### 🔴 Landmine fixed in #33 — read before touching the Android build
Capacitor's Android template is **Java-only**, and nothing in our build applied the Kotlin Gradle
plugin. Gradle does **not** fail on `.kt` sources when the plugin is missing — it silently ignores
them. So every APK up to and including **v79 shipped none of the app's native code**, while the
`AndroidManifest.xml` still declared the listener `<service>` and widget `<receiver>`.

Symptoms this caused (all of which looked like unrelated feature bugs):
- Auto-detect toggle, **Open system settings** and diagnostics appeared dead — `MainActivity.kt`
  never compiled, so `registerPlugin()` never ran and every native call rejected (silently swallowed).
- Notification access could be **granted** and MoneyIQ appeared in Android's list, but nothing was
  ever captured — Android could not instantiate a class that was not in the APK.
- Home-screen widget was dead for the same reason.

Now enforced by `scripts/verify-android-native.mjs`, which unzips the built APK, scans
`classes*.dex` and **fails the build** if any required class is missing. Both Android workflows run
it after building. A green Gradle build is *not* evidence for this class of bug — always check the
artifact. (The script was validated against the known-broken v79 APK first.)

> **If you ever regenerate or upgrade the Android platform**, re-run a build and confirm the
> `Verify native Kotlin is in the APK` step still passes.


### 🟡 In flight
| Branch/PR | Feature | State |
|----|---------|-------|
| — | **On-device re-test of auto-detect + receipt scan** | Blocked on user testing APK **v81** (`17edf37`) — the first build that actually contains the native Kotlin |
| — | **Gmail scan finds nothing** | Unexplained. CSP is fixed and the Google client ID *is* baked into the APK (verified in the bundle), and the scan is pure JS so it never depended on the native fix. Needs the exact on-screen message from `describeScan()` in `GmailScanButton` to narrow: no matching mail vs. all already scanned vs. matched but no readable amount vs. 401/403. |
| `vrk/voice-input-v1` | **Epic V — voice transaction entry (English + Hindi)** | **V.0 + V.1 done**: parser (`voiceParser.ts`, `hindiNumbers.ts`) plus the web layer — `speechEngine.ts` (on-device-only probe/sessions), `/voice-add`, `VoiceReview`, FAB "Speak" action. 80 voice tests; 201 total. Design in `docs/VOICE_INPUT_DESIGN.md`. **V.2.0 WebView spike next.** |

### 📋 Designed, not started
- **E.2–E.4** Statement→auto-account · balance auto-update · RBI Account Aggregator *(see §2)*
- **F** Splitwise settle-up notifications *(designed below)*

### Compliance follow-ups (Epic C)
- **Notification access** + **Gmail read-only** disclosures: see `playstore/DATA_SAFETY.md`. Data safety unchanged (on-device); Gmail needs Google Cloud consent-screen scope + test users now, OAuth verification + CASA before production.

### Infra notes
- GitHub Pages Actions-deploy backend was congested 08-06 (deploys hung 10 min); self-healed 08-07. `deploy.yml` now has `cancel-in-progress: true`. Temporary `gh-pages` branch fallback used during the outage has been removed.
- Google Play "developer verification / app registration" (deadline **Sep 30 2026**): no repo action — verify MoneyIQ shows registered in Play Console → Home (Play App Signing covers keys).

### Play Store status
- MoneyIQ live on **Internal testing**; moving to **Closed testing** (needs 12 testers / 14 days for production access). Release via `v*.*.*` tag → `android-release.yml` (now targets **API 36**). Sideload test APKs via `android-debug.yml` (`gh workflow run android-debug.yml --ref <branch>`).

---

## 1a. Epic G — First-run setup wizard  🆕 (in dev on `vrk/onboarding-catalog`)

**Goal:** a guided, skippable first-run flow so a new user's dashboard is useful from day one.

- Route `/welcome` (`src/features/onboarding/`), gated by a data-aware `SetupGuard` in `router.tsx`:
  new users (no transactions, `moneyiq_setup_complete` unset) are routed in; existing users are never nagged.
- Steps: **Welcome → Accounts** (reuses E.1 preset catalog) **→ Categories** (review defaults + create custom
  categories/subcategories via existing `CategoryForm`) **→ Import** (optional deep-links to statement `/import`
  and payslip `/salary`). "Skip setup" / "Finish" set the completion flag.
- Re-runnable anytime from **Settings → Data → Re-run setup wizard** (`resetSetup()` → `/welcome`).
- Flag helpers: `src/features/onboarding/setupStatus.ts` (`moneyiq_setup_complete`).

### E.1 building blocks delivered
- `src/shared/constants/onboardingCatalog.ts` — tap-to-add presets (banks, cards, wallets, BNPL, loans).
- `src/shared/utils/loanCalculator.ts` (+ 13 vitest cases) — EMI, amortization, derive repaid/outstanding.
- `src/features/accounts/components/AccountCatalog.tsx` (tile grid) + `LoanCalculator.tsx` (compute-don't-ask),
  wired into `AccountForm` (`initial` prefill prop) and `AccountsPage` ("Quick add").

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

---

## 3a. Epic V — Voice transaction entry (English + Hindi)  🆕

Full design: **`docs/VOICE_INPUT_DESIGN.md`**. Speak a sentence — "spent 450 on groceries at DMart
yesterday using UPI" or "paanch sau rupaye sabzi pe cash se kharch kiye" — and get a pre-filled,
reviewable transaction.

### The constraint that drives every decision
Play **Data safety** already declares that financial parsing is on-device and nothing raw is
uploaded. Audio must therefore **never leave the device**, and the failure mode to avoid is a
*silent cloud fallback* that would make a truthful declaration false without anyone noticing.

| Target | Engine | On-device? |
|---|---|---|
| Web, Chrome 139+ | Web Speech with `processLocally: true` | ✅ spec-enforced |
| Web, older Chrome / Safari / Firefox | Web Speech (vendor cloud) | ❌ not offered |
| Android native | `createOnDeviceSpeechRecognizer()` (API 33+) | ✅ |
| `@capacitor-community/speech-recognition` | `createSpeechRecognizer()` — cloud | ❌ **rejected** |
| iOS | `SFSpeechRecognizer` + `requiresOnDeviceRecognition` | ✅ locale-dependent |

We write our own `SpeechBridgePlugin.kt` because the community plugin (a) uses the cloud recognizer
with no on-device option, (b) exposes a single `language` string so Hinglish
(`EXTRA_ENABLE_LANGUAGE_SWITCH`) is impossible, and (c) has a broken `getSupportedLanguages()` on
Android 13+ — exactly where on-device recognition lives. A third Kotlin plugin is the established
pattern here (`NotificationBridgePlugin`, `WidgetBridgePlugin`) and inherits `verify-android-native.mjs`.

### Phases — each independently shippable and revertable
| Phase | Scope | Risk |
|---|---|---|
| **V.0 ✅ done** | `voiceParser.ts` + `hindiNumbers.ts` + 59 tests. Pure functions, **imported by nothing** | none |
| **V.1 ✅ done** | `speechEngine.ts` (probe + on-device-only sessions), `/voice-add` page, `VoiceReview`, FAB "Speak" action, `/add` prefill extended with `category`/`account`/`toAccount`. 21 more tests | low — realised: mic renders only when the probe finds an on-device engine, and the whole feature is a 22 KB lazy chunk |
| **V.2.0** | Throwaway spike: does Web Speech actually work in *our* WebView? MDN reports `webview_android: "mirror"`, which means *inferred, not tested* | none |
| **V.2** | `SpeechBridgePlugin.kt`, `RECORD_AUDIO`, guard entry, prominent disclosure, 4 compliance docs | medium — native |
| **V.3** | Hinglish via `EXTRA_ENABLE_LANGUAGE_SWITCH` + language-pack download | low |
| **V.4** | iOS — **blocked**, no iOS shell yet | — |

**V.2 acceptance test: voice must work in aeroplane mode.** That is the proof recognition is
on-device, rather than a claim.

### Compliance notes
- `RECORD_AUDIO` is a Dangerous permission but needs **no special Play declaration form** (unlike
  SMS/Call Log). It does need **prominent in-app disclosure before the system prompt**, plus a
  working alternative (typing). "Audio: not collected" stays truthful because nothing is transmitted.
- iOS needs **both** `NSMicrophoneUsageDescription` *and* `NSSpeechRecognitionUsageDescription` —
  missing either crashes on first use and fails Guideline 5.1.1.
- Not biometric data: GDPR Art. 9 covers voice only when processed *to uniquely identify a person*.
  Speech-to-text for data entry is not identification.
- Raw audio is never stored — the industry norm for finance apps.

---

## 4. Global security & privacy principles (all epics)
- **Local-first, on-device** parsing/compute; raw financial text/files never uploaded.
- **Voice/audio never leaves the device**, and never falls back to a cloud recogniser: use only
  engines that *enforce* on-device processing. Raw audio is never stored.
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
7. **V.2.0 WebView spike** — does Web Speech actually work in our Capacitor WebView? (V.0 parser and V.1 web layer are merged.) Then V.2 native.

## 6. How to resume (any device / agent)
1. Read this file + `ARCHITECTURE.md`.
2. Check open PRs (`gh pr list`) and this doc's status tables.
3. Pick the next item from §5, branch as `vrk/<context>` (see `CONTRIBUTING.md`), implement, validate
   (`tsc -b` · `npm run lint` · `npx vitest run` · `npm run build:capacitor`), PR to `master`.
4. **Update this file** (status + PR) so nothing is lost.
