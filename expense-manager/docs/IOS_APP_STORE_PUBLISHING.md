# MoneyIQ — iOS / App Store Publishing Playbook

End-to-end guide for shipping the MoneyIQ iOS app. Companion to
[`PLAY_STORE_PUBLISHING.md`](../PLAY_STORE_PUBLISHING.md) (Android).

> Repo: `vikasreddykamalapuram/expense-manager` · Bundle id: `io.github.vikasreddykamalapuram.moneyiq`
> Pipeline: [`.github/workflows/ios-release.yml`](../../.github/workflows/ios-release.yml)

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| **Apple Developer Program** — USD 99/yr | Without it you cannot create a distribution certificate or an App Store provisioning profile. There is no free path to TestFlight or the App Store. |
| **A Mac** — optional but recommended | Only needed to *create* the signing assets in §2 and for day-to-day debugging. The release build itself runs on a GitHub macOS runner. |
| GitHub repo secrets | §3 below. |

**Windows cannot build an iOS app.** Xcode is macOS-only, so a Windows dev box
can build the shared web bundle (`npm run build:capacitor`) and nothing further.
That is not a configuration gap to work around — it is the reason
`ios-release.yml` exists.

### The cost that shapes this pipeline

macOS runners bill at a **10× multiplier** on private repositories. One iOS
build is ~20–30 min wall clock ≈ **200–300 billable minutes**, i.e. 10–15% of
the 2,000 min/month Free allowance **per build**.

Consequences, all deliberate:

- iOS is **not** wired to the shared `v*.*.*` tag that Android uses. An Android
  release must never silently spend an iOS build. Use `ios-v*` or the Run
  workflow button.
- `concurrency.cancel-in-progress` is **false**. Discarding 20 minutes of macOS
  time to restart is the most expensive thing this repo can do.
- The secret guard runs **first**, so a missing secret costs 5 seconds and not a
  full archive.
- The cleanup sweep protects the **two most recent** `.ipa` artifacts from age
  expiry, because re-running an iOS build to recover a deleted one is far more
  expensive than the storage it frees.

---

## 2. One-time Apple setup

Do this once on a Mac (or in the Apple Developer web console).

### 2a. Register the App ID

[developer.apple.com](https://developer.apple.com/account) → **Certificates, IDs & Profiles → Identifiers → +**

| Field | Value |
|---|---|
| Type | App IDs → App |
| Description | `MoneyIQ` |
| Bundle ID | **Explicit** → `io.github.vikasreddykamalapuram.moneyiq` |
| Capabilities | Leave defaults. (No push, no App Groups yet.) |

> The bundle id **must** match `appId` in `capacitor.config.ts`. The workflow
> reads it from that file and compares it against the provisioning profile,
> failing early with both values named rather than letting `codesign` fail later
> with a message that mentions neither.

### 2b. Create the distribution certificate

Easiest via Xcode: **Xcode → Settings → Accounts → [your team] → Manage
Certificates → + → Apple Distribution**.

Then export it **with its private key**:

**Keychain Access → My Certificates →** right-click *Apple Distribution: …* →
**Export** → `.p12` → set a strong password (this becomes
`IOS_DIST_CERT_PASSWORD`).

> Export from **My Certificates**, not *Certificates*. The latter exports the
> public certificate without the private key, which imports into the CI keychain
> without error and then fails at signing time with "no identity found".

### 2c. Create the App Store provisioning profile

**Profiles → + → Distribution → App Store Connect** → select the App ID from
2a → select the certificate from 2b → name it something stable like
`MoneyIQ App Store` → **Download**.

### 2d. Create the app record in App Store Connect

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps → + → New App**

| Field | Value |
|---|---|
| Platform | iOS |
| Name | `MoneyIQ` |
| Primary language | English (India) |
| Bundle ID | the App ID from 2a |
| SKU | `moneyiq-ios` |

**Done when:** you hold a `.p12`, a `.mobileprovision`, your 10-character Team
ID, and the app exists in App Store Connect.

---

## 3. GitHub secrets

The workflow reads these. All four are required; the build refuses to start
without them.

```bash
REPO=vikasreddykamalapuram/expense-manager

# Team ID — Apple Developer > Membership details
gh secret set APPLE_TEAM_ID --body 'AB12CD34EF' --repo $REPO

# Distribution certificate (.p12 from 2b), base64-encoded
base64 -i ~/path/to/MoneyIQ-Distribution.p12 | pbcopy
gh secret set IOS_DIST_CERT_P12_BASE64 --repo $REPO      # paste when prompted

gh secret set IOS_DIST_CERT_PASSWORD --body 'THE_P12_PASSWORD' --repo $REPO

# Provisioning profile (.mobileprovision from 2c), base64-encoded
base64 -i ~/Downloads/MoneyIQ_App_Store.mobileprovision | pbcopy
gh secret set IOS_PROVISIONING_PROFILE_BASE64 --repo $REPO
```

On Windows PowerShell, substitute:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\cert.p12")) | Set-Clipboard
```

### Already required by the Android pipeline (reused as-is)

`VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`.

These are **inlined into the JS bundle at build time**. Missing them yields an
`.ipa` that installs and launches but can neither sign in nor sync — a failure
that only appears on a tester's device, which is why the guard step treats them
as hard requirements rather than optional.

### Only for automatic TestFlight upload

App Store Connect → **Users and Access → Integrations → App Store Connect API →
+**, role *App Manager*. The `.p8` downloads **once** and cannot be re-downloaded.

```bash
gh secret set APPSTORE_API_KEY_ID --body 'XXXXXXXXXX' --repo $REPO
gh secret set APPSTORE_API_ISSUER_ID --body '<issuer-uuid>' --repo $REPO
base64 -i ~/Downloads/AuthKey_XXXXXXXXXX.p8 | pbcopy
gh secret set APPSTORE_API_PRIVATE_KEY_BASE64 --repo $REPO
```

Verify:

```bash
gh secret list --repo $REPO
```

---

## 4. Running the build

**Actions → iOS Release IPA → Run workflow**

| Input | Meaning |
|---|---|
| `app_version` | `CFBundleShortVersionString`, e.g. `3.2.1`. Blank = read from `package.json`. |
| `upload_to_testflight` | Push straight to App Store Connect when the build succeeds. |

Or by tag:

```bash
git tag ios-v3.2.1
git push origin ios-v3.2.1
```

`CFBundleVersion` is the **run number** — monotonic and unique, because App
Store Connect permanently rejects a build number it has already seen. You never
manage it by hand.

Download the artifact:

```bash
RUN=$(gh run list --workflow=ios-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run download $RUN -D ./moneyiq-ios
```

### What the pipeline actually checks

After `exportArchive` it runs `scripts/verify-ios-bundle.mjs` against the real
`.ipa`. A green `xcodebuild` does **not** prove a working app — two failures
look identical to it:

1. `cap sync ios` did not run → the archive contains the native shell with no
   web assets. The app installs, launches, and shows a permanent white screen.
2. A purpose string is missing from `Info.plist` → iOS **kills the process** the
   instant the API is touched. The receipt scanner is triggered from plain HTML
   file inputs, so no amount of `tsc`, `eslint` or `vitest` can catch it.

This mirrors the Android guard, which exists because Gradle silently ignored
every `.kt` file and shipped ~79 APKs containing none of the app's native code
— all with green builds. **The build is not evidence; the artifact is.**

The verifier also asserts a **positive control** (`CFBundleIdentifier`) before
reporting anything as missing. `Info.plist` inside a built `.app` is a *binary*
plist, so if the reader were wrong every key would look absent and the run would
fail with a confident, entirely fictional diagnosis.

---

## 5. TestFlight

With `upload_to_testflight` checked, the build appears under **App Store Connect
→ TestFlight** after ~5–15 min of Apple-side processing.

1. Complete the **export compliance** prompt — already answered in the plist
   (§7) so it should not appear.
2. **Internal testing** — up to 100 users on your team, no review needed.
3. **External testing** — up to 10,000 users, requires a Beta App Review
   (~24–48 h for the first build).

To upload a downloaded `.ipa` by hand instead, use **Transporter.app** from the
Mac App Store.

---

## 6. App Store submission

App Store Connect → your app → **+ Version**.

| Item | Notes |
|---|---|
| Screenshots | 6.7" (iPhone 15 Pro Max) and 6.5" required. Simulator captures are fine. |
| Description / keywords | Reuse `playstore/en-IN/` copy, trimmed to Apple's limits. |
| Privacy policy URL | **Must resolve.** See the hosting note in §9. |
| App Privacy | Mirror `playstore/DATA_SAFETY.md`: financial data + email + user IDs, collected for app functionality, **not** used for tracking. |
| Age rating | 4+ (no objectionable content). |
| Account deletion | Apple requires an in-app path. Settings → Advanced → Delete cloud sync data, plus the public deletion URL. |

**Guideline 5.1.1** is the one to watch: any permission prompt must be preceded
by an in-app explanation, and the purpose strings must describe the *specific*
use. Ours are written that way in `scripts/patch-ios-plist.mjs`.

**Guideline 4.2 (minimum functionality)** is the risk for any WebView-shipped
app. MoneyIQ clears it because it is genuinely offline-first — an IndexedDB
database, on-device OCR, biometric lock and local notifications — rather than a
wrapper around a website. Keep it that way.

---

## 7. Origins, OAuth, and the WebView scheme

The two platforms serve the web bundle from **different origins**, and that is
deliberate:

| Platform | Origin |
|---|---|
| Android | `https://localhost` |
| iOS | `capacitor://localhost` |
| Web (PWA) | the real hosting origin |

iOS does **not** match Android here because WKWebView treats an `https` custom
scheme as a real network origin, where it collides with genuine `https`
requests.

**The scheme is the origin, and the origin namespaces IndexedDB.** Every user's
entire financial history lives in that database, so changing either value after
release orphans real data with no migration path. Treat both as frozen.

Anything that allow-lists an origin must therefore list **all three**:

- Supabase → Authentication → URL Configuration → Redirect URLs
- Google Cloud console → OAuth client → Authorized JavaScript origins
- The CSP `connect-src` in `index.html`

A missing entry here fails only at sign-in, only on one platform — so test
sign-in on a real iOS build before shipping, not just on the simulator.

### Universal Links — not yet wired

Android App Links are live via `assetlinks.json`. The iOS equivalent needs an
`apple-app-site-association` file on the web host **and** an Associated Domains
entitlement. Deliberately deferred: the web host is moving off GitHub Pages
(§9), and pointing Universal Links at a domain we are about to stop using would
only have to be redone. The `moneyiq://` custom scheme works today.

---

## 8. Building locally on a Mac

```bash
cd expense-manager
npm ci
npm run cap:ios          # build web -> sync -> patch plist -> open Xcode
```

Then in Xcode: select a simulator or device and press ⌘R.

For a signed archive by hand:

```bash
npm run ios:release      # build web -> sync -> patch plist -> pod install
open ios/App/App.xcworkspace
# Xcode: Product > Archive > Distribute App > App Store Connect
```

Verify a local export the same way CI does:

```bash
node scripts/verify-ios-bundle.mjs ~/path/to/MoneyIQ.ipa
```

> `ios/` is gitignored. It is generated by `npx cap add ios` and holds
> per-machine Xcode state, exactly like `android/`. Never commit it, and never
> hand-edit it expecting the change to survive — put it in
> `scripts/patch-ios-plist.mjs` instead, which is idempotent and runs on every
> sync.

---

## 9. Hosting dependency (read before making the repo private)

MoneyIQ's privacy policy and account-deletion URLs are registered in Play
Console and will be registered with Apple. They are currently served by **GitHub
Pages from this public repo**.

Making the repo private on a Free plan **stops Pages serving**, which 404s those
URLs and puts the Play Store listing at risk of suspension. Migrate hosting
(Vercel / Cloudflare Pages both serve from private repos on their free tiers)
and verify the URLs resolve **before** flipping visibility, then update:

- Play Console → privacy policy + account deletion URLs
- App Store Connect → privacy policy URL
- `public/.well-known/assetlinks.json` host
- the deep-link host in `scripts/patch-android-manifest.mjs`
- the CSP `connect-src` origin in `index.html`

---

## 10. Troubleshooting

| Symptom | Cause |
|---|---|
| `No signing certificate "iOS Distribution" found` | The `.p12` was exported without its private key. Re-export from Keychain Access → **My Certificates** (§2b). |
| `Provisioning profile is for 'X' but capacitor.config.ts declares 'Y'` | The guard did its job. Create an App ID + profile for the declared bundle id. |
| Build hangs during signing, then times out | `security set-key-partition-list` failed, so codesign is waiting on a GUI prompt no one can answer. Check the keychain import step's log. |
| App installs but shows a white screen | `cap sync ios` did not run. `verify-ios-bundle.mjs` catches this — check it is still in the workflow. |
| App crashes when tapping *Scan receipt* | A purpose string is missing. Run `node scripts/patch-ios-plist.mjs` after every `cap sync`. |
| `This build is invalid` after upload | Almost always a reused `CFBundleVersion`. Re-run the workflow; the run number advances automatically. |
| Sign-in fails only on iOS | `capacitor://localhost` is missing from an origin allow-list (§7). |
| TestFlight asks about export compliance every upload | `ITSAppUsesNonExemptEncryption` did not make it into the plist. |

---

_Last updated: 2026-09-07 · Pipeline: `.github/workflows/ios-release.yml`_
