# Play Console Upload Checklist

Follow this once when creating the app; then only the release steps matter for each new version.

## One-time setup

- [ ] Create Google Play Developer account ($25 one-time).
- [ ] In Play Console → **Create app**:
  - App name: `MoneyIQ`
  - Default language: `English (India)`
  - App or game: `App`
  - Free or paid: `Free`
- [ ] Complete **App content** section:
  -   Privacy Policy URL: `https://vikasreddykamalapuram.github.io/expense-manager/privacy-policy.html`
  - App access: `All functionality available without restrictions` (no login required)
  - Ads: `No, my app does not contain ads`
  - Content rating: run the questionnaire → expect `Everyone`
  - Target audience: `18+`
  - Data safety form:
    - Does your app collect or share user data? **Yes** (only when the user opts into cloud sync)
    - Account creation methods supported: **OAuth** (Google / Microsoft sign-in) — tick OAuth only
    - Delete account URL: `https://vikasreddykamalapuram.github.io/expense-manager/account-deletion.html`
    - Personal info: `Email address` — Collected, Optional, purpose: **App functionality**, encrypted in transit, **NOT shared**
    - Personal info: `User IDs` — Collected, Optional, purpose: **App functionality**, encrypted in transit, **NOT shared**
    - Financial info: `Other financial info` (transactions, accounts, budgets) — Collected, Optional, purpose: **App functionality**, encrypted in transit, **NOT shared**
    - Data shared with third parties: **None** (Supabase is the developer's own backend/processor, not a third party under Play's definition)
    - Data encrypted in transit: **Yes**
    - User can request deletion: **Yes** (in-app via Settings → Advanced → Delete cloud sync data, or the Delete account URL above)
    - Committed to Play Families Policy: N/A (not aimed at children)
- [ ] **Store listing** → paste from `playstore/en-IN/*`:
  - App name → `title.txt`
  - Short description → `short-description.txt`
  - Full description → `full-description.txt`
- [ ] **Graphic assets** (produce with any image editor):
  - App icon: `512x512.png` (use `assets/icon.png`)
  - Feature graphic: `1024x500.png` (create in Figma / Canva — banner)
  - Phone screenshots: 4–8 images, `1080x1920` or `1080x2400` (capture on device)
- [ ] Set the app category: `Finance`.

## First internal test release

- [ ] Play Console → **Testing → Internal testing** → Create a new release
- [ ] Upload the `.aab` from the `android-release.yml` workflow artifact
- [ ] Add release notes (see `playstore/release-notes.md`)
- [ ] Add your Gmail as an internal tester → save → send opt-in link
- [ ] Install via the opt-in link → verify everything works

## Every subsequent release

1. Bump `version` in `expense-manager/package.json`.
2. Commit and push to master (this deploys the web PWA).
3. Tag the commit: `git tag v3.1.0 && git push origin v3.1.0`.
4. Wait for the `android-release.yml` GitHub Actions workflow to finish.
5. Download the `.aab` artifact from the run.
6. Play Console → Internal testing → new release → upload the AAB.
7. Rollout to internal testers.
8. Once verified, promote the same release to Closed / Open / Production.

## Digital Asset Links (App Links auto-verification)

After the first release upload, Play Console shows the signing certificate fingerprint at:
**Setup → App integrity → App Signing → SHA-256 certificate fingerprint**

Copy that fingerprint into `expense-manager/public/.well-known/assetlinks.json`, replacing `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT`. Commit and redeploy the web app. Android will then automatically open `https://vikasreddykamalapuram.github.io/expense-manager/*` links in the installed app.

Verify with:
```
adb shell pm verify-app-links --re-verify io.github.vikasreddykamalapuram.moneyiq
adb shell pm get-app-links io.github.vikasreddykamalapuram.moneyiq
```

## Play Store Data safety declaration (cheat sheet)

If the user does NOT enable cloud sync: declare **no data collected**.

If the user enables cloud sync, technically the app collects:

| Type | Purpose | Optional? | Encrypted in transit? |
|------|---------|-----------|-----------------------|
| Financial info | App functionality | Yes | Yes (E2E, AES-256-GCM) |

Data is NEVER shared with third parties. User can request deletion via in-app Settings.

### Auto-detect (notification listener + Gmail) disclosures

The auto-detect features (share / notification listener / Gmail read-only) parse everything
**on-device** and transmit nothing, so they add **no new *collected* data types** to the form.
They do have separate requirements (notification-access declaration; Gmail restricted-scope
verification/CASA for production, test users for now). See **`playstore/DATA_SAFETY.md`** for the
full declaration + exact Play Console and Google Cloud steps.
