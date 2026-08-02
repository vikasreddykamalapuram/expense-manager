# MoneyIQ — Play Console Asset Checklist

Everything you need to attach in **Play Console → Store listing** and **App content**.
Text content lives in `playstore/en-IN/` and `playstore/release-notes.md`.

## Graphic assets

| Asset | Spec | Source in repo | Status |
|-------|------|----------------|--------|
| App icon | 512×512 PNG, 32-bit, no alpha on outer edge | `public/icons/icon-512.png` | ✅ exists |
| Feature graphic | 1024×500 PNG/JPG, no transparency | `playstore/assets/feature-graphic.svg` → export PNG | ⚙️ export once |
| Phone screenshots | 2–8 images, 16:9 or 9:16, each side 320–3840 px | `scripts/capture-screenshots.sh` | ⚙️ capture |
| 7"/10" tablet shots | Optional | — | skip for now |

### Export the feature graphic to PNG (Mac)
```bash
# Option A — librsvg (crispest)
brew install librsvg
rsvg-convert -w 1024 -h 500 \
  playstore/assets/feature-graphic.svg \
  -o playstore/assets/feature-graphic.png

# Option B — no brew, uses npx
npx -y sharp-cli -i playstore/assets/feature-graphic.svg \
  -o playstore/assets/feature-graphic.png resize 1024 500
```

### Capture phone screenshots
```bash
# Install a debug build on a running emulator / connected phone first:
cd android && ./gradlew installDebug && cd ..
# Then capture interactively (prompts you per screen):
bash scripts/capture-screenshots.sh
```
Aim for 4–6 covering: **Dashboard, Add transaction, Analytics, Budgets, Monthly report, Stock portfolio.**
Use demo/rounded values — avoid real personal balances in public screenshots.

## Store listing text (paste from these files)

| Field | File | Limit | Current |
|-------|------|-------|---------|
| App name | `playstore/en-IN/title.txt` | 30 | `MoneyIQ — Personal Finance` (26) |
| Short description | `playstore/en-IN/short-description.txt` | 80 | 75 chars ✅ |
| Full description | `playstore/en-IN/full-description.txt` | 4000 | 2431 chars ✅ |
| Release notes | `playstore/release-notes.md` | 500/lang | v3.2.1 |

## App content answers

| Section | Value |
|---------|-------|
| Privacy policy URL | `https://vikasreddykamalapuram.github.io/expense-manager/privacy-policy.html` |
| Delete account URL | `https://vikasreddykamalapuram.github.io/expense-manager/account-deletion.html` |
| App access | All functionality available without special access |
| Ads | No ads |
| Content rating | IARC questionnaire → all "No" → Everyone / 3+ |
| Target audience | 18+, not directed at children |
| Government app | No |
| Financial features | Personal finance / budgeting (read-only stock tracking; no trading) |
| Category / tags | Finance · Budgeting, Expense tracker, Personal finance |

### Data safety
- Collects data: **Yes** (cloud sync only). Account creation: **OAuth**. Delete account URL above.
- Collected (Optional · App functionality · encrypted in transit · **not shared**): Email address, User IDs, Other financial info.
- Shared with third parties: **None** (Supabase is our own backend). Encrypted in transit: **Yes**. Deletion: **Yes**.

## First Internal testing release
1. Testing → Internal testing → Create new release.
2. Accept Play App Signing; upload the AAB (built from tag `v3.2.1`).
3. Release name `3.2.1 (<run number>)`; paste release notes.
4. Add your Gmail as a tester; save the opt-in URL; install and smoke-test.
5. After first upload: copy Play App Signing **SHA-256** into `public/.well-known/assetlinks.json` (see PLAY_STORE_PUBLISHING Phase 10).
