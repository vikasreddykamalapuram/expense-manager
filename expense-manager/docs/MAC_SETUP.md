# Mac Setup — Android platform for MoneyIQ

Complete step-by-step guide for setting up the Android build/test environment on macOS. Every command is copy-paste ready. Use **Terminal** or **Google Antigravity** — the shell commands are identical.

> **Tip for Antigravity users:** Open the workspace in Antigravity, use the built-in terminal (`⌘ + `` ` ``), and let Antigravity's agent verify each step against the guide. Point it at this file: _"Follow docs/MAC_SETUP.md and verify each step succeeded."_ It can catch missing steps for you.

---

## Table of contents

1. [Prerequisites (one-time)](#1-prerequisites-one-time)
2. [Clone the repository](#2-clone-the-repository)
3. [Install Node dependencies](#3-install-node-dependencies)
4. [Set up Android platform](#4-set-up-android-platform)
5. [Run the app on your phone / emulator](#5-run-the-app-on-your-phone--emulator)
6. [Generate app icons + splash](#6-generate-app-icons--splash)
7. [Create the release keystore](#7-create-the-release-keystore)
8. [Upload keystore secrets to GitHub](#8-upload-keystore-secrets-to-github)
9. [Build a release AAB locally (optional)](#9-build-a-release-aab-locally-optional)
10. [Common issues on macOS](#10-common-issues-on-macos)

---

## 1. Prerequisites (one-time)

### 1a. Xcode Command Line Tools

```bash
xcode-select --install
```

Wait for the popup, click Install, agree to the license. Verify:

```bash
xcode-select -p
# → /Library/Developer/CommandLineTools
```

### 1b. Homebrew

Skip if you already have `brew`.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After install, follow the "Next steps" it prints — usually two `eval` lines to add brew to your PATH. Add them to `~/.zshrc`:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
brew --version
```

### 1c. Git + gh CLI

```bash
brew install git gh
git --version
gh --version
gh auth login   # follow prompts — use your personal vikasreddykamalapuram GitHub account
```

### 1d. Node.js 20 (via nvm — recommended)

```bash
brew install nvm
mkdir -p ~/.nvm
```

Add to `~/.zshrc`:

```bash
cat >> ~/.zshrc <<'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
EOF
source ~/.zshrc

nvm install 20
nvm use 20
nvm alias default 20
node --version   # → v20.x
npm --version
```

### 1e. JDK 21 (Temurin)

Capacitor 7 + Android Gradle Plugin now require **JDK 21** (older Capacitor plugins were fine with 17, but newer plugin releases target Java 21).

```bash
brew install --cask temurin@21
```

Verify:

```bash
/usr/libexec/java_home -V
# You should see "Eclipse Temurin 21..."

/usr/libexec/java_home -v 21
# → /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
```

Add to `~/.zshrc` so it's the default:

```bash
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
java -version   # → openjdk version "17.0.x"
```

### 1f. Android Studio + SDK

```bash
brew install --cask android-studio
```

Open Android Studio once:

- Welcome screen → **More Actions → SDK Manager**
- **SDK Platforms** tab: check **Android 14 (API 34)** and **Android 13 (API 33)**
- **SDK Tools** tab: check
  - Android SDK Build-Tools 34.0.0 (or latest)
  - Android SDK Command-line Tools (latest)
  - Android SDK Platform-Tools
  - Android Emulator
  - Google Play services
  - Intel x86 Emulator Accelerator / **Android Emulator hypervisor driver** (Apple Silicon uses the built-in ARM one automatically)
- Click **Apply** → agree to licenses → wait for downloads.

Note the SDK location (typically `~/Library/Android/sdk`). Add to `~/.zshrc`:

```bash
cat >> ~/.zshrc <<'EOF'
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
EOF
source ~/.zshrc

adb --version
sdkmanager --version
```

Accept SDK licenses (from the terminal, once):

```bash
yes | sdkmanager --licenses
```

### 1g. (Optional) Create an Android Virtual Device (emulator)

In Android Studio → **More Actions → Virtual Device Manager** → **Create Device**:
- Choose **Pixel 7** (or any modern phone)
- System image: **Android 14 (API 34)** → click Download → Next → Finish

Or from the terminal:

```bash
avdmanager create avd -n Pixel_7_API_34 \
  -k "system-images;android-34;google_apis;arm64-v8a" \
  --device "pixel_7"
```

Start it:

```bash
emulator -avd Pixel_7_API_34 &
```

---

## 2. Clone the repository

```bash
cd ~/Repos    # or wherever you keep code; create the folder if needed
mkdir -p ~/Repos && cd ~/Repos

gh repo clone vikasreddykamalapuram/expense-manager
cd expense-manager
```

Switch to the mobile branch:

```bash
git fetch --all
git checkout v-vikaska-microsoft-mobile-app-capacitor
```

If the branch isn't there yet, ask me to push it first. Otherwise:

```bash
git checkout -b v-vikaska-microsoft-mobile-app-capacitor origin/v-vikaska-microsoft-mobile-app-capacitor
```

Configure git identity for this repo (if not global):

```bash
git config user.email "vikasreddykamalapuram@gmail.com"
git config user.name "vikasreddykamalapuram"
```

---

## 3. Install Node dependencies

```bash
cd expense-manager    # the nested folder — actual app lives here
npm ci
```

This takes 2–3 minutes the first time. Ignore npm deprecation warnings.

Verify:

```bash
npm run build         # should end with "PWA v1.2.0 / precache N entries"
npm test              # 12 tests pass
```

---

## 4. Set up Android platform

The `/android` folder is git-ignored — every dev generates it locally.

```bash
# From expense-manager/expense-manager
npx cap add android
```

This creates the `android/` folder with a full Gradle project.

**Now patch the manifest** with deep-link intent filters + notification permissions:

```bash
node scripts/patch-android-manifest.mjs
```

Expected output:
```
  + permission android.permission.INTERNET
  + permission android.permission.VIBRATE
  + permission android.permission.USE_BIOMETRIC
  + permission android.permission.POST_NOTIFICATIONS
  + permission android.permission.SCHEDULE_EXACT_ALARM
  + permission android.permission.RECEIVE_BOOT_COMPLETED
  + deep-link intent filters
✓ AndroidManifest.xml patched
```

Sync the web bundle into the native project:

```bash
npm run build
npx cap sync android
```

Verify Gradle can build the debug variant:

```bash
cd android
./gradlew assembleDebug
cd ..
```

First run downloads Gradle + AGP + dependencies (~5 min). Subsequent builds take 30–60s.

Successful output ends with:
```
BUILD SUCCESSFUL in 4m 23s
```

Debug APK lands at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Run the app on your phone / emulator

### Option A: on a physical Android phone (recommended for haptics + biometric testing)

1. On the phone: **Settings → About phone → tap "Build number" 7 times** to unlock Developer Options.
2. **Settings → System → Developer options → USB debugging: ON**.
3. Plug the phone into your Mac via USB-C.
4. On the phone: tap **Allow USB debugging?** when prompted.

Verify Mac sees it:

```bash
adb devices
# → List of devices attached
#   XXXXXXXX	device
```

Run the app:

```bash
# From expense-manager/expense-manager
npm run cap:run:android
```

It builds, syncs, installs, and launches. If prompted, choose your physical device.

### Option B: on an emulator

Start an emulator first (see step 1g), then:

```bash
npm run cap:run:android
```

### Option C: live-reload (dev-server on Mac, WebView loads from your Mac)

Fastest iteration — edits reflect in the app without rebuilding.

Find your Mac's local IP:

```bash
ipconfig getifaddr en0   # e.g. 192.168.1.42
```

Add a temporary section to `capacitor.config.ts`:

```ts
server: {
  androidScheme: 'https',
  url: 'http://192.168.1.42:5173',     // ← use YOUR IP
  cleartext: true,
},
```

Then:

```bash
npm run dev &                # Vite dev server on :5173
npx cap run android
```

**Important:** revert the `capacitor.config.ts` change before committing / building release.

---

## 6. Generate app icons + splash

The repo has base assets in `expense-manager/assets/`. Regenerate all Android resource densities:

```bash
npm run cap:assets
```

This uses `@capacitor/assets` to produce:
- `android/app/src/main/res/mipmap-*/ic_launcher*.png` (icon densities)
- `android/app/src/main/res/drawable-*/splash.png` (splash densities)

Rebuild:

```bash
npx cap sync android
```

To customize colors, edit the `cap:assets` script in `package.json` (`--iconBackgroundColor`, `--splashBackgroundColor`).

To use a different source icon, replace `assets/icon.png` (should be 1024×1024 PNG, no transparency) and re-run `npm run cap:assets`.

---

## 7. Create the release keystore

**One-time.** Do NOT commit the keystore file — it's already git-ignored.

```bash
cd android/app     # from expense-manager/expense-manager/android/app

keytool -genkey -v \
  -keystore release.keystore \
  -alias expenseiq \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12
```

Answer the prompts:
- Store password: **pick a strong one** — record it in your password manager NOW.
- First & last name: `Vikas Kamalapuram`
- Organizational unit: `MoneyIQ`
- Organization: `Personal`
- City / State / Country: your info
- Correct? → **yes**
- Key password: **hit ENTER to reuse the store password** (simpler for CI).

Verify:

```bash
keytool -list -v -keystore release.keystore | head -20
```

Note the **SHA-256 fingerprint** — you'll paste it into `public/.well-known/assetlinks.json`:

```bash
keytool -list -v -keystore release.keystore | grep 'SHA256:'
# → SHA256: 12:AB:34:CD:...
```

Then:

```bash
cd ../..    # back to expense-manager/expense-manager
```

Edit `public/.well-known/assetlinks.json` and replace `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT` with the exact fingerprint (keep the colons).

---

## 8. Upload keystore secrets to GitHub

CI will build signed AABs using these secrets:

```bash
cd expense-manager/android/app

# 1. Base64-encode the keystore (macOS built-in `base64`)
base64 -i release.keystore | pbcopy   # copies to clipboard
```

Now, in your browser:

1. Go to **https://github.com/vikasreddykamalapuram/expense-manager/settings/secrets/actions**.
2. Click **New repository secret** for each of these four:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Paste (⌘V) — the clipboard has the base64 |
| `ANDROID_KEYSTORE_PASSWORD` | The store password you set in step 7 |
| `ANDROID_KEY_ALIAS` | `expenseiq` |
| `ANDROID_KEY_PASSWORD` | Same as store password |

Now trigger the release build:

```bash
cd ../..   # back to expense-manager/expense-manager
git tag v3.1.0
git push origin v3.1.0
```

Watch the run:

```bash
gh run watch
```

Or open **https://github.com/vikasreddykamalapuram/expense-manager/actions**.

When done, download the AAB artifact:

```bash
gh run download --name "expenseiq-release-aab-$(git rev-parse HEAD)"
ls -lh *.aab
```

That AAB is what you upload to Play Console (see `playstore/UPLOAD_CHECKLIST.md`).

---

## 9. Build a release AAB locally (optional)

Only needed for debugging signing issues. CI is the source of truth.

Create `android/keystore.properties`:

```properties
storeFile=release.keystore
storePassword=YOUR_PASSWORD
keyAlias=expenseiq
keyPassword=YOUR_PASSWORD
```

Then:

```bash
node scripts/inject-signing-config.mjs    # patches android/app/build.gradle
npm run android:release
```

Outputs land at:
- `android/app/build/outputs/bundle/release/*.aab`
- `android/app/build/outputs/apk/release/*.apk`

⚠ **NEVER** commit `android/keystore.properties` — it's git-ignored, keep it that way.

---

## 10. Common issues on macOS

### "Command not found: adb / sdkmanager / emulator"
`~/.zshrc` didn't reload. Fix: `source ~/.zshrc`. Verify `$ANDROID_HOME` is set: `echo $ANDROID_HOME`.

### "Unsupported class file major version 65" during Gradle build
JDK version mismatch. You have JDK 21+ but Gradle wants JDK 17.
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### "SDK location not found" when running `./gradlew`
Create `android/local.properties`:
```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
```
(Capacitor should generate this automatically; only needed if missing.)

### `cap sync android` says "capacitor.settings.gradle not found"
The `android` folder is corrupt. Regenerate:
```bash
rm -rf android
npx cap add android
node scripts/patch-android-manifest.mjs
```

### App installs but crashes immediately on launch
Almost always missing permissions or JS error. Get the logs:
```bash
adb logcat -c   # clear
# launch the app on the device, then:
adb logcat --pid=$(adb shell pidof -s io.github.vikasreddykamalapuram.moneyiq) > crash.log
```
Look for `chromium:` or `Capacitor/Console:` lines. Send those to me.

### "Unable to install app-debug.apk: INSTALL_FAILED_UPDATE_INCOMPATIBLE"
You installed a differently-signed version earlier. Uninstall first:
```bash
adb uninstall io.github.vikasreddykamalapuram.moneyiq
```

### "adb: command not found" after fresh install
Add platform-tools to PATH (see step 1f). Or invoke it directly:
```bash
~/Library/Android/sdk/platform-tools/adb devices
```

### Biometric prompt does not appear
- On emulators: **Extended Controls (three dots) → Fingerprint → Add finger → Touch sensor**.
- On real device: at least one fingerprint / face must be enrolled in system Settings.

### Deep links open the browser instead of the app
1. Verify the intent-filter is in `AndroidManifest.xml`: `grep -A 3 'android:host' android/app/src/main/AndroidManifest.xml`.
2. After first release upload to Play Console, copy the **App Signing SHA-256** into `public/.well-known/assetlinks.json`, redeploy the web app, then run: `adb shell pm verify-app-links --re-verify io.github.vikasreddykamalapuram.moneyiq`.
3. Verify: `adb shell pm get-app-links io.github.vikasreddykamalapuram.moneyiq` → status should be `verified`.

### `npm run cap:assets` fails with "sharp" install error
```bash
npm install --include=optional sharp
npm run cap:assets
```

### `emulator: ERROR: HAX is not working` on Apple Silicon
You're using an x86 system image. Use ARM64:
```bash
sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```
Recreate the AVD from that image.

### Xcode disk space warning after Android Studio install
Android Studio + SDK + emulators easily use 20+ GB. Free space with:
```bash
xcrun simctl delete unavailable            # iOS simulators you don't use
```
Then in Android Studio, **Device Manager** → delete unused emulators.

---

## Summary — the 10-command "happy path" on a fresh Mac

Once prerequisites (Homebrew, JDK 21, Android Studio) are done:

```bash
gh repo clone vikasreddykamalapuram/expense-manager && cd expense-manager
git checkout v-vikaska-microsoft-mobile-app-capacitor
cd expense-manager
npm ci
npx cap add android
node scripts/patch-android-manifest.mjs
npm run build
npx cap sync android
npm run cap:assets
npm run cap:run:android
```

The app should launch on your connected phone / emulator.

---

### Testing Phase B features (shortcuts, share, widget)

After first install, test each mobile-integration surface:

**1. App Shortcuts (launcher long-press)**
- Long-press the MoneyIQ icon on your home screen / app drawer.
- You should see: **Expense**, **Income**, **Analytics**, **Budgets**.
- Tap **Expense** → app opens directly to the Add Transaction form with type=expense.

**2. Share target (bank SMS → prefilled add)**
- Open any bank-style SMS or note text like `"Rs. 500 debited at Uber on 25-Jul"`.
- Long-press → **Share** → pick **MoneyIQ**.
- App opens with amount `500` and note `Uber` prefilled.

**3. Home-screen widget**
- Long-press an empty area on your home screen → **Widgets** → find **MoneyIQ**.
- Drag it to the home screen. It shows this month's expense total.
- Tap the "Add expense" button → deep-links into the app.
- The widget refreshes automatically whenever you add/edit/delete a transaction.

If the widget shows "—" indefinitely, add one transaction — the JS bridge fires on any transactions change and populates SharedPreferences.

---

### Using this guide in Antigravity

Open the workspace in Antigravity, then chat with the agent:

> "Follow docs/MAC_SETUP.md step by step. Run each command and confirm success. Stop and ask me if any step fails."

The agent will execute the shell commands in the built-in terminal and validate outputs against the expected results in this guide. If something errors, paste the error and it'll consult section 10 (Common issues) automatically.

---

## 12. Automated e2e tests with Maestro

We use [Maestro](https://maestro.mobile.dev/) for end-to-end UI flows against the installed Android app. Flows live in `.maestro/flows/` as declarative YAML and run against either a local emulator/device or in CI on an Android emulator runner.

### 12.1 Install Maestro locally (Mac)

```bash
# One-time install
curl -Ls "https://get.maestro.mobile.dev" | bash

# Add to PATH (add to ~/.zshrc if you want it permanent)
export PATH="$PATH:$HOME/.maestro/bin"

# Verify
maestro --version
```

### 12.2 Run flows against a local emulator

```bash
# 1. Boot an emulator (any AVD you have — Pixel 6 API 33 recommended)
$ANDROID_HOME/emulator/emulator -avd Pixel_6_API_33 -no-snapshot &

# 2. Build & install the debug APK
cd expense-manager
npm run build
npx cap sync android
node scripts/patch-android-manifest.mjs
(cd android && ./gradlew installDebug)

# 3. Run all flows
maestro test .maestro/flows

# Or run a single flow
maestro test .maestro/flows/01-smoke.yaml

# Or filter by tag (see the `tags:` block at the top of each flow)
maestro test .maestro/flows --include-tags=smoke
```

Maestro prints a live report and writes screenshots + logs to `~/.maestro/tests/<timestamp>/`. Failed flows keep a screenshot of the last state.

### 12.3 What each flow does

| Flow | What it validates |
| --- | --- |
| `01-smoke.yaml` | Cold launch reaches the Dashboard within 20s. Auth-wall dismissed via "Continue without". |
| `02-add-expense.yaml` | Adding a ₹500 transaction navigates back to the list. |
| `03-recurring-rule.yaml` | Recurring-rule form opens without regression (guards the earlier UX bug). |
| `04-insights.yaml` | Insights page renders Cashflow Projection + Spending Forecast (Phase C). |

### 12.4 Run flows in CI

The `E2E Maestro Flows` workflow (`.github/workflows/e2e-maestro.yml`) runs on:
- PRs to `master` that touch app source, flows, capacitor config, or the manifest patcher
- Manual dispatch from the Actions tab (with an optional single-flow filter)

CI boots a fresh Android 33 emulator, installs the debug APK, and runs every flow. Screenshots + JUnit report are uploaded as the `maestro-artifacts-<sha>` artifact — download it from the workflow run to inspect failures without needing a local Android setup.

### 12.5 Adding new flows

1. Copy an existing flow file as a template — e.g. `cp .maestro/flows/01-smoke.yaml .maestro/flows/05-my-flow.yaml`.
2. Update the `tags:` block and steps. Prefer text selectors — Maestro walks the accessibility tree so any user-facing string works.
3. Add `- takeScreenshot: 05-checkpoint-name` at meaningful checkpoints so CI artifacts tell a story.
4. Run locally: `maestro test .maestro/flows/05-my-flow.yaml`.
5. Commit — CI will pick it up automatically on the next PR.

### 12.6 Common Maestro issues

| Symptom | Fix |
| --- | --- |
| `Element not found: "Total Balance"` | The app hasn't finished bootstrapping. Bump the `timeout` on the preceding `extendedWaitUntil`, or add a text alternative separated by `\|`. |
| `Failed to connect to device` | Ensure an emulator is booted (`adb devices`). If empty, restart the emulator. |
| Flow passes locally, fails in CI | Emulator is slower in CI — widen timeouts and prefer `extendedWaitUntil` over plain `waitFor`. |
| Screenshots not uploaded from CI | Check that the flow actually ran (Maestro must have executed at least one `takeScreenshot`). |
