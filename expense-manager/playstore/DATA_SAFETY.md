# Data Safety & Permissions — Auto-detect (Notification listener + Gmail read-only)

This covers the extra disclosures needed for the **auto-detect** features (Epic C):
share-intent (C.1), on-device **notification listener** (C.2), and **Gmail read-only** scan (C.3).

> **Key principle:** all parsing happens **on the device**. Notification text and Gmail
> message previews are read locally, matched for a transaction, and shown in an in-app
> **review queue**. Nothing is stored as a transaction until the user confirms it, and
> **none of this data is transmitted off the device** by MoneyIQ.

---

## 1. Play Console → Data safety form

Under Google Play's definitions, **"collection" = data your app transmits off the device.**
Auto-detect processes everything locally, so it introduces **no new *collected* data types**.
The existing declaration (below) stays correct.

| Data type | Collected? | Why |
|-----------|-----------|-----|
| Email address, User IDs | Yes (optional) | Only when the user enables **cloud sync** |
| Financial info (transactions/accounts/budgets) | Yes (optional) | Only when the user enables **cloud sync**, E2E-encrypted |
| Notification content | **No** | Read on-device only, never transmitted |
| Emails / messages (Gmail) | **No** | Read on-device only (message previews), never transmitted |

**Action:** no change to the Data safety *collected/shared* answers. Keep "Data shared: None",
"Encrypted in transit: Yes", deletion URL as-is.

> If Play's form asks specifically about "Messages" or "Emails" with an *"accessed but not
> collected"* option, choose **not collected / not shared** and note on-device processing.

---

## 2. Notification access (C.2) — `BIND_NOTIFICATION_LISTENER_SERVICE`

Reading notifications is a sensitive capability. To keep the listing compliant:

- **In-app prominent disclosure (already implemented):** Settings → Notifications →
  *Auto-detect* shows a privacy notice and the feature is **opt-in, off by default**; the
  user must also grant Android "notification access" in system settings.
- **Privacy policy:** must mention that, with permission, the app reads notifications
  **on-device** to detect transactions (updated — see `PRIVACY_POLICY.md`).
- **Play Console:** If the review flags notification access, respond in
  **App content → (Sensitive app permissions / declarations)** that it is **core feature**
  functionality (transaction detection), opt-in, on-device, with a demo/how-to. Provide a
  short video of the grant + review flow if requested.

---

## 3. Gmail read-only (C.3) — `https://www.googleapis.com/auth/gmail.readonly`

`gmail.readonly` is a **restricted** OAuth scope governed by the
**Google API Services User Data Policy (Limited Use)** — this is a **Google Cloud** process,
separate from Play Console.

**For closed/internal testing (works now):**
1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Enabled APIs** → enable **Gmail API**.
2. **OAuth consent screen** → keep publishing status **Testing** → under **Test users**, add each tester's Gmail (up to 100). Restricted scopes work for test users without full verification.
3. **OAuth consent screen → Data access / Scopes** → add `.../auth/gmail.readonly`.
4. Add the **Limited Use** statement to the privacy policy (done — see below).

**Before Production (public release):**
- Submit the app for **OAuth verification**, and because it's a restricted scope, complete the
  **annual CASA security assessment** (third-party). Budget time/cost for this.
- Until verified, keep Gmail scan available only to test users, or gate it behind a flag.

**Limited Use commitment (add to privacy policy + Cloud consent screen):**
> MoneyIQ's use of information received from Google APIs adheres to the
> [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
> including the **Limited Use** requirements. Gmail data is used **only on-device** to detect
> transactions the user chooses to add; it is never transferred to others, used for ads, or
> for any purpose other than the user-facing feature.

---

## 4. Step-by-step: updating Play Console

1. **Play Console → your app → Policy → App content → Data safety → Manage → Edit.**
2. Walk through the form; the collected/shared answers are **unchanged** (Section 1).
3. Where relevant, confirm **notification content** and **email** are **not collected/shared**
   (on-device). Save & submit the form.
4. **App content → Privacy policy** → ensure the URL points to the updated policy
   (`https://vikasreddykamalapuram.github.io/expense-manager/privacy-policy.html`).
5. If a **permissions/notification-access declaration** appears, complete it citing core
   functionality + opt-in + on-device.
6. Publish; the Data safety card on the store listing updates after review.

For Gmail, remember the **Google Cloud** steps (Section 3) are separate from Play Console.
