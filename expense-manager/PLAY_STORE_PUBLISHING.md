# ExpenseIQ — Google Play Store Publishing Playbook

Complete end-to-end guide to ship ExpenseIQ to the Google Play Store from a Mac.
Follow the phases in order. Each phase lists prerequisites, exact commands, and a "done when" check.

> Repo: `vikasreddykamalapuram/expense-manager` · Branch: `master` · Package: `com.expenseiq.app`

---

## Phase 0 — One-time prerequisites

**On Mac:**
```bash
# Toolchain
brew install --cask temurin@17          # Java 17 (Android Gradle Plugin requirement)
brew install --cask android-commandlinetools
brew install gh                          # GitHub CLI, for triggering + downloading builds
gh auth login                            # authenticate once

# Node (if not present)
brew install node@20
```

**Google account:** the Gmail you'll use for the Play Console. A **one-time USD 25 registration fee** is required.

**Done when:** `java -version` prints 17.x, `gh auth status` shows you're logged in.

---

## Phase 1 — Generate the release keystore (do this ONCE, keep forever)

The keystore signs every future update. **If you lose it, you can never update the app again** — Play App Signing helps but the upload key must still match.

```bash
cd ~/repos/expense-manager           # or wherever your clone lives
mkdir -p ~/expenseiq-secrets
cd ~/expenseiq-secrets

keytool -genkeypair -v \
  -keystore expenseiq-release.keystore \
  -alias expenseiq \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass 'CHOOSE_A_STRONG_PASSWORD' \
  -keypass 'CHOOSE_A_STRONG_PASSWORD' \
  -dname "CN=Vikas Kamalapuram, OU=ExpenseIQ, O=Personal, L=Hyderabad, ST=Telangana, C=IN"
```

**Back it up NOW to at least two places:**
- iCloud Drive: `~/Library/Mobile Documents/com~apple~CloudDocs/keystores/`
- A password manager attachment (1Password/Bitwarden)
- An offline USB drive

```bash
cp expenseiq-release.keystore ~/Library/Mobile\ Documents/com~apple~CloudDocs/keystores/
```

**Done when:** the `.keystore` file is safely in ≥2 backup locations and the passwords are in your password manager.

---

## Phase 2 — GitHub Secrets (so CI can build a signed AAB)

Base64-encode the keystore and register 4 secrets in the repo:

```bash
cd ~/expenseiq-secrets
base64 -i expenseiq-release.keystore | pbcopy   # copies to clipboard on Mac

# Register secrets via gh CLI (paste from clipboard when prompted for KEYSTORE_BASE64)
gh secret set ANDROID_KEYSTORE_BASE64 --repo vikasreddykamalapuram/expense-manager
gh secret set ANDROID_KEYSTORE_PASSWORD --body 'CHOOSE_A_STRONG_PASSWORD' --repo vikasreddykamalapuram/expense-manager
gh secret set ANDROID_KEY_ALIAS --body 'expenseiq' --repo vikasreddykamalapuram/expense-manager
gh secret set ANDROID_KEY_PASSWORD --body 'CHOOSE_A_STRONG_PASSWORD' --repo vikasreddykamalapuram/expense-manager
```

Verify all four are present:
```bash
gh secret list --repo vikasreddykamalapuram/expense-manager
```

**Done when:** `gh secret list` shows all four `ANDROID_*` secrets.

---

## Phase 3 — Build the signed AAB via GitHub Actions

The `.github/workflows/android-release.yml` workflow triggers on any `v*.*.*` git tag. It:
1. Runs `npm ci` + `vite build` to compile the PWA.
2. Runs `cap sync android` to hydrate the Android project.
3. Applies the manifest + gradle patches.
4. Decodes the keystore, injects signing config, runs `./gradlew bundleRelease assembleRelease`.
5. Uploads `app-release.aab` + `app-release.apk` as workflow artifacts.

**Tag and push:**
```bash
cd ~/repos/expense-manager
git checkout master
git pull

# package.json version is already 3.2.0 — tag matches
git tag v3.2.0
git push origin v3.2.0

# Watch the run (~5 min)
gh run watch
```

**If the run fails:** read the failing step's logs, fix the issue, then re-tag:
```bash
git tag -d v3.2.0
git push origin :refs/tags/v3.2.0
# ...commit fix, push, then:
git tag v3.2.0
git push origin v3.2.0
```

**Download the AAB when the run turns green:**
```bash
RUN_ID=$(gh run list --workflow=android-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
mkdir -p ~/Downloads/expenseiq-v3.2.0
gh run download $RUN_ID -D ~/Downloads/expenseiq-v3.2.0
find ~/Downloads/expenseiq-v3.2.0 -name "*.aab"
```

**Done when:** you have a local `app-release.aab` file (~10–20 MB).

---

## Phase 4 — Publish the privacy policy URL

Play Console **requires a public privacy policy URL** for apps that collect any personal data (email, account IDs, financial info — we collect all three).

The policy already lives at `expense-manager/public/privacy-policy.html`. GitHub Pages serves it automatically after the next deploy of `master`.

**Public URL** (paste into Play Console later):
```
https://vikasreddykamalapuram.github.io/expense-manager/privacy-policy.html
```

**Verify** in a browser before proceeding — Play Console rejects broken links.

**Done when:** the URL loads and shows the current privacy policy.

---

## Phase 5 — Play Console account setup

1. Open **https://play.google.com/console/signup**.
2. Choose **"An organization"** if you want ExpenseIQ under a brand later; else **"Myself"**.
3. Pay the **USD 25 one-time fee** (credit card, non-refundable).
4. Complete developer profile: legal name, address, phone (India OK), support email (`vikasreddykamalapuram@gmail.com`).
5. Verify identity (Play Console will guide you — govt ID + selfie for individual accounts).

**Done when:** you're inside the Play Console dashboard with **"Create app"** visible.

---

## Phase 6 — Create the app in Play Console

Click **"Create app"** and fill:

| Field | Value |
|-------|-------|
| App name | `ExpenseIQ` |
| Default language | English (India) — `en-IN` |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both boxes (Play policies + US export laws) |

Click **"Create app"**. You'll land on the app dashboard with a setup checklist.

---

## Phase 7 — Complete the setup checklist

Work through each item top-to-bottom. Reference material lives in `playstore/`:

### 7a. App access
- Choose **"All functionality is available without special access"** unless you're locking features behind login (we don't).

### 7b. Ads
- **No ads.**

### 7c. Content ratings
- Fill the IARC questionnaire. ExpenseIQ has no violence/gambling/user-generated content → will get **"Rated for 3+"** or equivalent.

### 7d. Target audience
- Ages 18+ (finance app).
- **Not directed at children.**

### 7e. Data safety
Use `playstore/UPLOAD_CHECKLIST.md` → *Data Safety* section. Declared items:
- **Personal info → Email address** — collected + shared to Supabase (RLS-isolated).
- **Personal info → User IDs** — collected + shared.
- **Financial info → Purchase history, other financial info** — collected + shared.
- All **encrypted in transit** (TLS 1.3), user can **request deletion** from Settings → Danger Zone.

### 7f. Government apps
- **No.**

### 7g. Financial features
- Tick **"Personal finance / budgeting"**. Not a lending app.

### 7h. Privacy policy URL
- Paste `https://vikasreddykamalapuram.github.io/expense-manager/privacy-policy.html`.

### 7i. App category
- Category: **Finance**.
- Tags: Budgeting, Expense tracker, Personal finance.

---

## Phase 8 — Store listing (marketing content)

Play Console → **Main store listing**.

Copy from `playstore/en-IN/`:

| Field | Source file | Limit |
|-------|-------------|-------|
| App name | `title.txt` | 30 chars |
| Short description | `short-description.txt` | 80 chars |
| Full description | `full-description.txt` | 4000 chars |

### Graphics required

| Asset | Size | Where |
|-------|------|-------|
| App icon | 512×512 PNG (32-bit, no transparency on outer edge) | `public/icons/icon-512.png` (already exists) |
| Feature graphic | 1024×500 PNG/JPG | **TO CREATE** — banner shown on Play listing |
| Phone screenshots | ≥2, at most 8. Min 320px, max 3840px, 16:9 or 9:16 | Capture on emulator |
| 7-inch tablet screenshots | Optional |  |
| 10-inch tablet screenshots | Optional |  |

**Quick screenshot capture on an Android emulator:**
```bash
cd ~/repos/expense-manager/android
./gradlew installDebug          # sideload debug build to running emulator
adb shell screencap -p /sdcard/screen1.png
adb pull /sdcard/screen1.png ~/Downloads/screenshots/
```
Aim for 4–6 screenshots covering: Dashboard, Add transaction, Analytics, Budget, Reports, Cross-device sync.

### Feature graphic
Fastest path: use Canva → search "Google Play Feature Graphic" → 1024×500 template → drop the ExpenseIQ logo + tagline "Smart personal finance, everywhere you are." → export PNG.

**Done when:** all fields + graphics are uploaded and the Store listing shows a **"Saved"** badge.

---

## Phase 9 — Internal testing track (mandatory first step)

Play policy: **new apps must ship on Internal / Closed / Open** before Production.

1. Play Console → **Testing → Internal testing → Create new release**.
2. **Choose signing key:** accept "Let Google manage & protect your app signing key" (Play App Signing). Upload your `expenseiq-release.keystore` as the **upload key**.
3. **Upload the AAB** from `~/Downloads/expenseiq-v3.2.0/`.
4. **Release name:** `3.2.0 (41)` — matches versionCode from CI.
5. **Release notes:** paste from `playstore/release-notes.md`.
6. **Testers:** create an email list (add your own gmail, at least 1 other). Save an **opt-in URL** — testers open it on their Android device, join, and Play Store surfaces the app.
7. Click **Review release → Start rollout to Internal testing**.

**Wait 10–60 min** for Play to process the AAB. When it's live:
- Open the opt-in URL on your phone.
- Install ExpenseIQ from Play Store.
- Verify: sign-in, add a transaction, sync round-trip with the web app.

**Done when:** you've installed the app from Play Store via the internal track and confirmed it works.

---

## Phase 10 — App Links (deep linking, autoverify)

For `https://vikasreddykamalapuram.github.io/expense-manager` links to open the app directly:

1. Play Console → **Setup → App integrity → App signing** → copy the **SHA-256 certificate fingerprint** (this is Play App Signing's, NOT your local keystore's).
2. Edit `public/.well-known/assetlinks.json` — replace `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT` with that SHA-256.
3. Commit + push:
   ```bash
   git add public/.well-known/assetlinks.json
   git commit -m "chore(applinks): wire Play App Signing SHA-256 into assetlinks.json"
   git push origin master
   ```
4. Wait for GitHub Pages redeploy (~1 min). Verify:
   ```bash
   curl https://vikasreddykamalapuram.github.io/expense-manager/.well-known/assetlinks.json
   ```
5. Play Console → **Setup → App links** → auto-verify shows green.

**Done when:** clicking a `https://vikasreddykamalapuram.github.io/expense-manager/...` link on your phone opens ExpenseIQ directly instead of a browser.

---

## Phase 11 — Promote to Production

Once internal testing is stable (recommend **7 days of dogfooding**):

1. Play Console → **Testing → Internal testing** → your release → **"Promote release" → Production**.
2. Choose **staged rollout %** (start at 20%, monitor crash-free rate for 48h, then bump to 100%).
3. Fill in the **Countries / regions** — start with `India` only; expand later.
4. Submit for review.

**Review time:** typically 1–3 days for first-time apps, few hours for updates.

**Done when:** Play Console shows **"Available on Google Play"** and searching for `ExpenseIQ` on your phone's Play Store returns your app.

---

## Ongoing release workflow

For every future update:

```bash
# 1. Bump version
npm version patch                     # 3.2.0 → 3.2.1 in package.json + auto-commit + tag
git push origin master
git push origin --tags

# 2. gh run watch (build AAB)
gh run watch

# 3. Download AAB
RUN_ID=$(gh run list --workflow=android-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download $RUN_ID -D ~/Downloads/expenseiq-latest

# 4. Play Console → Production → Create new release → upload AAB → rollout
```

**Semantic versioning:**
- `npm version patch` — bug fixes only (3.2.0 → 3.2.1)
- `npm version minor` — new features, backwards compatible (3.2.1 → 3.3.0)
- `npm version major` — breaking changes / big rewrite (3.3.0 → 4.0.0)

`versionCode` (Play Store's monotonic integer) is auto-derived in CI from `GITHUB_RUN_NUMBER` — you don't have to manage it.

---

## Troubleshooting

### AAB build fails at "Build release AAB + APK"
Read the failing step's Gradle output. Common causes:
- **"unknown property 'release'"** — signingConfigs injection bug. See commit `dd8c322` for reference fix.
- **"keystore was tampered with, or password was incorrect"** — one of the 4 `ANDROID_*` GitHub secrets is wrong. Re-set them.
- **"SDK location not found"** — CI-side issue; usually a stale `local.properties`. Nuke it in `patch-android-build.mjs`.

### Play Console rejects the upload
- **"You need to use a different version code"** — you tried uploading the same versionCode twice. Bump and re-tag.
- **"The Android App Bundle was not signed"** — the CI didn't actually inject the release signing config. Check the "Inject signingConfig into build.gradle" step output.
- **"You uploaded a debuggable APK or Android App Bundle"** — release build got signed with the debug keystore. Verify `signingConfig signingConfigs.release` is present in the CI's patched `build.gradle`.

### App installs but crashes on launch
```bash
adb logcat -c && adb logcat | grep -i "expenseiq\|AndroidRuntime"
```
Attach the log to a new session and we'll triage.

### Cross-device sync shows "not configured" after Play Store install
The Supabase URL + anon key are injected as CI env vars at build time (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). If missing:
```bash
gh secret list --repo vikasreddykamalapuram/expense-manager | grep SUPABASE
```
Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be present.

---

## References inside this repo

- `playstore/UPLOAD_CHECKLIST.md` — Data Safety cheat sheet + submit-day checklist
- `playstore/PRIVACY_POLICY.md` — canonical privacy policy text (mirror of the html)
- `playstore/en-IN/` — localized store listing (title, short, full description)
- `playstore/release-notes.md` — release notes template + history
- `docs/MAC_SETUP.md` — deeper Mac dev environment notes
- `public/privacy-policy.html` — the URL you paste into Play Console
- `public/.well-known/assetlinks.json` — App Links verification
- `.github/workflows/android-release.yml` — the CI that builds the AAB
- `scripts/inject-signing-config.mjs` — release keystore injection into gradle
- `scripts/patch-android-build.mjs` — versionCode/versionName + debug signing
- `scripts/patch-android-manifest.mjs` — AndroidManifest tweaks

---

_Last updated: 2026-07-29 · Currently at Phase 3 (waiting for green AAB build on tag `v3.2.0`)._
