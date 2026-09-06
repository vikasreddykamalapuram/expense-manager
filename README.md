# MoneyIQ — public hosting mirror

This repository **publishes** MoneyIQ. It does not contain its source.

| | |
|---|---|
| **Live site** | https://vikasreddykamalapuram.github.io/expense-manager/ |
| **Source code** | `vikasreddykamalapuram/moneyiq` (private) |
| **Published branch** | `gh-pages` — generated, force-updated by CI |

MoneyIQ is a local-first personal finance manager: expenses, budgets, salary and
tax intelligence, receipt scanning, an investment portfolio, and Splitwise-style
shared expenses. Data lives in your browser (IndexedDB) or on your device, with
optional end-to-end encrypted cloud sync.

---

## ⚠️ Do not rename, delete, or make this repository private

That sounds dramatic. It is load-bearing, and the reasons are not obvious.

GitHub Pages derives its URL from the repository **name**, and does not serve
private repositories on the Free plan. Three things **already in users' hands**
depend on `https://vikasreddykamalapuram.github.io/expense-manager/` continuing
to resolve:

1. **Sign-in for the published Android app.** The OAuth redirect URL
   `…/oauth/callback.html` is *compiled into* the app already distributed on
   Google Play. Google and Microsoft send users back to that exact address
   mid-sign-in. If it stops resolving, every existing install loses sign-in —
   and **no server-side change can fix it**, because the URL is inside bundles
   already on people's phones. It is also registered as an authorized redirect
   URI in the Google Cloud OAuth client.

2. **Play Store compliance.** The privacy-policy and account-deletion URLs
   registered in Play Console point here. A 404 on either is grounds for the
   listing to be suspended.

3. **Android App Links.** `/.well-known/assetlinks.json` is what verifies this
   host as an owner of the app's links.

The source was made private without breaking any of the above precisely
*because* this repository kept its name and kept serving. That only holds while
it stays that way.

## Why `.nojekyll` exists here

Pages runs Jekyll on branch-based deploys, and Jekyll **skips
dot-directories**. Without `.nojekyll`, `/.well-known/` is silently dropped
from the published site: the build stays green, no error appears anywhere, and
App Links simply stop verifying. The file is empty on purpose — its existence
is the entire signal.

## How publishing works

CI in the private source repo builds the site and pushes the output to
`gh-pages` here, over an SSH deploy key scoped to this repository alone. A
pre-publish guard refuses to ship a build that is missing any of the URLs
listed above, because all of them are static files copied at build time and
would otherwise vanish silently.

Stock prices are refreshed on a weekday schedule and mirrored to `gh-pages`
directly, without a full rebuild.

**Do not edit `gh-pages` by hand.** It is overwritten on every deploy.

## Issues

Bug reports and feature requests are welcome here — the issue tracker for this
project stays public even though the code is not.

---

_Licensed for personal use. © Vikas Kamalapuram_
