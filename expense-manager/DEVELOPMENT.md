# ExpenseIQ — Development Setup Guide

Everything you need to build, test, and run ExpenseIQ locally as a **web app**
and as a **mobile app** (Android via Capacitor). Follow the sections in order
the first time; after that, jump straight to the "Everyday commands"
cheat‑sheet at the bottom.

> All commands are shown for **Windows PowerShell**. On macOS / Linux the
> commands are identical unless noted. Every command assumes your current
> directory is `expense-manager/` (i.e. this folder), not the repo root.

---

## 1. Prerequisites (one‑time, per machine)

### Required for the web app
| Tool | Minimum version | How to install |
|---|---|---|
| **Node.js** | 20 LTS (or newer) | https://nodejs.org/ — pick "LTS". Verify: `node -v` |
| **npm** | 10.x (bundled with Node) | `npm -v` |
| **Git** | any recent | https://git-scm.com/download/win |

### Additional tools required for the mobile (Android) build
| Tool | Minimum version | How to install |
|---|---|---|
| **JDK** | 17 (Temurin recommended) | `winget install EclipseAdoptium.Temurin.17.JDK` |
| **Android Studio** | Koala (2024.1) or newer | https://developer.android.com/studio |
| **Android SDK Platform** | API 34 (Android 14) | Installed via Android Studio → SDK Manager |
| **Android SDK Build‑Tools** | 34.x | SDK Manager → "SDK Tools" tab |
| **Android SDK Command‑line Tools** | latest | SDK Manager → "SDK Tools" tab |

### Environment variables (Android only, Windows)
Add these to *User environment variables* (search "Edit environment
variables for your account"), then restart your terminal:

```
JAVA_HOME     = C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot
ANDROID_HOME  = C:\Users\<you>\AppData\Local\Android\Sdk
```

And append these to `Path`:
```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
%ANDROID_HOME%\emulator
```

Verify:
```powershell
java -version           # should print "17.x"
adb version             # should print "Android Debug Bridge version..."
sdkmanager --version    # should print a version number
```

> **iOS builds are Mac‑only** and are not covered here. When we're ready
> we'll do them on a Mac with Xcode 15+.

---

## 2. Clone and install (one‑time, per checkout)

```powershell
git clone https://github.com/vikasreddykamalapuram/expense-manager.git
cd expense-manager\expense-manager   # the app lives one level deep
npm ci                               # installs exact versions from package-lock.json
```

### Optional: Local environment variables
Copy the sample and fill in any OAuth client IDs / Supabase keys you want to
use locally. The app runs without this file — you just won't be able to
sign in with Google/Microsoft or use cloud sync.

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

---

## 3. Running the web app locally

### 3.1 Dev server (with hot reload)
```powershell
npm run dev
```
Opens at **http://localhost:5173/expense-manager/** (Vite may pick a
different port if 5173 is busy — check the terminal output).

Notes:
- Uses the Vite HMR server — edits reload instantly.
- The service worker is **disabled** in dev, so no stale‑chunk issues here.

### 3.2 Production build (what actually gets deployed to GitHub Pages)
```powershell
npm run build
```
This runs three steps:
1. `node scripts/generate-sitemap.mjs` — regenerates `sitemap.xml`.
2. `tsc -b` — full TypeScript type‑check.
3. `vite build` — bundles + generates the PWA service worker into `dist/`.

### 3.3 Preview the production build locally
```powershell
npm run preview
```
Serves `dist/` at http://localhost:4173/expense-manager/ — this is the best
way to test the service worker, offline mode, and code splitting behavior.

### 3.4 Lint
```powershell
npm run lint
```

### 3.5 Tests
```powershell
npm test                # single run (12 tests: encryption + auth)
npm run test:watch      # interactive watch mode
```

---

## 4. Running the mobile app locally (Android)

> Complete Section 1's Android prerequisites first. `java -version`, `adb
> version`, and `sdkmanager --version` must all work in a fresh terminal
> before you continue.

### 4.1 First‑time: add the Android platform
The `/android` folder is git‑ignored (it's generated per machine). Run
this **once** in every fresh clone:

```powershell
npm run build                    # produce dist/ so Capacitor has something to copy
npx cap add android              # scaffolds android/ using capacitor.config.ts
```

Capacitor will:
- Create `android/` (Gradle project, `AndroidManifest.xml`, etc.).
- Register the plugins you have installed (`@capacitor/app`,
  `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/status-bar`,
  `@capacitor/splash-screen`).

### 4.2 Set up an Android emulator OR plug in a device

**Option A — Emulator (recommended for quick UI checks):**
1. Open Android Studio.
2. `More Actions` → `Virtual Device Manager` → `Create device`.
3. Pick "Pixel 7" → System image **API 34 (Android 14)** → Finish.
4. Click ▶ to boot the emulator.

**Option B — Physical device:**
1. On your phone: `Settings` → `About phone` → tap "Build number" 7 times to
   unlock Developer options.
2. `Developer options` → enable **USB debugging**.
3. Plug in via USB → allow the debugging prompt.
4. Verify: `adb devices` should list your phone.

### 4.3 Build & run the app on the device/emulator

The npm scripts wrap the common flows:

```powershell
# Build the web bundle, copy it into android/, and open Android Studio
npm run cap:android

# OR: build, sync, and run directly on the connected device / emulator
npm run cap:run:android

# Just copy an already-built dist/ into android/ (fast; no rebuild)
npx cap sync android
```

Under the hood these run:
```
vite build          → produces dist/
cap sync android    → copies dist/ into android/app/src/main/assets/public/
                      and refreshes native plugin bindings
cap open android    → launches Android Studio
cap run android     → gradle assembles + installs the debug APK, then launches it
```

### 4.4 Iterating on mobile
When you change **web code** (React / TS / CSS):
```powershell
npm run cap:sync    # = npm run build + npx cap sync
```
Then press ▶ in Android Studio (or re-run `cap run android`).

When you change **native config** (`capacitor.config.ts`, add/remove a
Capacitor plugin, `AndroidManifest.xml`):
```powershell
npx cap sync android
# and rebuild in Android Studio
```

### 4.5 Live reload against a Vite dev server (optional, faster inner loop)
For rapid UI iteration you can point the WebView at your dev server so
changes hot‑reload inside the app:

1. Find your machine's LAN IP (`ipconfig` → IPv4 of your Wi‑Fi adapter,
   e.g. `192.168.1.42`).
2. Start Vite bound to all interfaces:
   ```powershell
   npx vite --host 0.0.0.0
   ```
3. Temporarily edit `capacitor.config.ts`:
   ```ts
   server: {
     androidScheme: 'https',
     url: 'http://192.168.1.42:5173/expense-manager/',
     cleartext: true,
   }
   ```
4. `npx cap sync android`, then run the app — it now loads live from Vite.
5. **Revert `capacitor.config.ts` before committing.**

### 4.6 Building a signed release APK / AAB
Only needed when you're ready to publish or share a real build.
```powershell
cd android
.\gradlew assembleRelease    # unsigned APK at android\app\build\outputs\apk\release\
```
Signing config + Play Store steps are a follow‑up — track separately.

---

## 5. Troubleshooting

### 5.1 Web app

**`TypeError: Failed to fetch dynamically imported module` in the browser**
→ Old service worker is serving stale `index.html` that references chunk
hashes which no longer exist on the server. Fixed by `lazyWithRetry` +
`RouteErrorFallback`; the app now auto‑reloads once. If it lands on the
manual fallback, click **Reload app** — that clears caches and unregisters
the SW. If it *still* recurs, in DevTools do:
`Application → Service Workers → Unregister`, then hard‑reload (Ctrl+Shift+R).

**Blank / stuck loader after deploy**
→ Same root cause as above. The auto‑reload should catch it; if not, force
one with DevTools → Application → Clear storage → "Clear site data".

**`npm ci` fails with `EBADENGINE` / peer‑dep errors**
→ Node version is too old. This repo needs Node 20+. Run `node -v`, then
install/upgrade from https://nodejs.org/ (LTS).

**`npm ci` fails on Windows with `EPERM: operation not permitted` or long‑path errors**
→ Enable long paths once:
```powershell
git config --system core.longpaths true
# and (as Administrator):
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```
Then delete `node_modules` and `package-lock.json.lock` if present and retry.

**`npm run dev` says "Port 5173 is in use"**
→ Another Vite instance is already running. Either close it, or start on a
different port: `npx vite --port 5174`.

**`npm run build` fails with TypeScript errors that don't show in the editor**
→ The editor's TS server is stale. In VS Code: `Ctrl+Shift+P` →
"TypeScript: Restart TS Server". Then re‑run the build. If the error is
real, fix it — `npm run build` is what CI runs.

**Google or Microsoft sign‑in popup closes immediately / "redirect_uri_mismatch"**
→ You're on a port the OAuth client isn't registered for (dev uses 5173,
preview uses 4173). Either use the registered port, or add your local URL
to the OAuth client's allowed redirect URIs in Google Cloud Console /
Entra portal.

**Stock prices show `N/A` for everything, not just delisted names**
→ Either `public/prices.json` is missing (run `node scripts/fetch-prices.mjs`
once locally), or the service worker cached an empty response — clear the
`stock-prices-cache` in DevTools → Application → Cache Storage.

**Tests hang or fail with "IndexedDB is not defined"**
→ You're running Vitest without the jsdom setup. Use `npm test` (which
respects the config), not `vitest` directly, or make sure your invocation
picks up `vite.config.ts`.

**PWA install prompt never appears**
→ Chrome/Edge require: served over HTTPS (or localhost), a valid
`manifest.json`, a service worker, and the "installability" heuristics.
Use DevTools → Application → Manifest to see exactly which criterion is
failing.

### 5.2 Mobile app (Capacitor / Android)

**`npx cap add android` fails with "capacitor.config.ts not found"**
→ You're in the wrong folder. Run from `expense-manager/` (the one that
contains `package.json` **and** `capacitor.config.ts`), not the repo root.

**`Gradle build failed. Cause: JAVA_HOME points to invalid JDK` / `Unsupported class file major version`**
→ You have JDK 8, 11, or 21. Capacitor 6 needs **JDK 17**. Update
`JAVA_HOME` (Section 1), restart the terminal, verify with `java -version`.
Inside Android Studio also check `File → Settings → Build Tools → Gradle
→ Gradle JDK` — set it to 17 explicitly.

**`SDK location not found` / `Please set ANDROID_HOME`**
→ Either set `ANDROID_HOME` (Section 1) or create
`android/local.properties` with:
```
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```
(Backslashes must be escaped in `.properties` files.)

**`Failed to install the following Android SDK packages ... licenses not accepted`**
→ Run once:
```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
```
Press `y` at each prompt.

**Emulator shows blank white screen**
→ You skipped `npm run build` before `cap sync`. The app loads `dist/`; if
`dist/` is empty or stale the WebView has nothing to render. Fix:
```powershell
npm run build
npx cap sync android
```
Then re‑launch from Android Studio.

**Emulator shows the "old" version of the app**
→ Capacitor copies `dist/` into `android/app/src/main/assets/public/` at
`cap sync` time. If you rebuilt web but didn't sync, the APK still ships
yesterday's bundle. Always chain: `npm run build && npx cap sync android`
(or use `npm run cap:sync`).

**Changes to React code don't show up in the running app**
→ Same issue: you edited source but didn't rebuild. Run `npm run cap:sync`,
then hit ▶ in Android Studio. For heavy UI iteration use the live‑reload
setup in Section 4.5 — code hot‑reloads in the WebView instantly.

**`adb devices` shows `unauthorized`**
→ Unlock your phone; there should be a "Allow USB debugging" popup — tap
"Always allow from this computer" → OK. If no popup appears: revoke USB
debugging authorizations under Developer Options and reconnect.

**`adb devices` shows nothing when the phone is plugged in**
→ Windows is missing the OEM USB driver. Install Google's universal driver
via SDK Manager → SDK Tools → "Google USB Driver", then use Device Manager
to point the "ADB Interface" at it. Also try a different USB cable — a
lot of cables are power‑only and don't carry data.

**`No target device found` when running `npx cap run android`**
→ Either no emulator is running and no device is plugged in, or Gradle
picked the wrong one. Launch an emulator from Android Studio first, or
target explicitly:
```powershell
npx cap run android --target=<device-id-from-adb-devices>
```

**Gradle build hangs at "Downloading gradle-8.x.zip" forever**
→ Corporate proxy / VPN blocking Gradle Distributions. Either disconnect
from the VPN for the first run, or configure Gradle's proxy in
`%USERPROFILE%\.gradle\gradle.properties`:
```
systemProp.https.proxyHost=your-proxy
systemProp.https.proxyPort=8080
```

**`Manifest merger failed` after adding a Capacitor plugin**
→ Two plugins declared conflicting `minSdkVersion` values. Bump the app's
`minSdkVersion` in `android/variables.gradle` to the highest one required
(usually 22 or 23 for the biometric/haptics plugins).

**Status bar overlaps the app content (Android)**
→ The default `bootstrapNativeShell()` sets a background color but doesn't
add insets. If you see this, wrap `Layout` in a container with
`padding-top: env(safe-area-inset-top)` and set
`StatusBar.setOverlaysWebView({ overlay: false })` in `nativeShell.ts`.

**Haptics don't fire on Android**
→ Check Settings → Sound & vibration → "Touch feedback" is enabled on the
device — some phones ship it off. Also confirm `haptic.isEnabled()`
returns `true` (the localStorage kill‑switch lives at
`expenseiq_haptics_enabled`).

**Pull‑to‑refresh doesn't trigger**
→ It only fires when `scrollTop === 0`. If your page has a fixed header
inside the scroll container, or you attached the hook to the wrong
element, the hook can never see `scrollTop === 0`. Attach the returned
`containerRef` to the actual overflow‑y‑auto element.

**Swipe‑to‑delete steals vertical scroll on the list**
→ Only if the direction‑lock logic misfires. The `SwipeableRow` decides
horizontal vs vertical on the first 10px. If touches on your row start
during a fast vertical scroll and the finger drifts, you may see this —
tap the row once to reset, or increase the direction‑lock threshold in
`SwipeableRow.tsx`.

**Google / Microsoft sign‑in doesn't work inside the Android app**
→ OAuth popup flows don't work in a WebView. For mobile you need either:
(a) Capacitor's Google/Microsoft OAuth plugin, or (b) an in‑app browser
(`@capacitor/browser`) that returns via deep link. Tracked as a follow‑up
in `plan.md`.

**`cap sync` deletes changes you made inside `android/`**
→ Never edit generated files under `android/app/src/main/assets/public/`
directly — those come from `dist/`. Native‑side edits belong in
`android/app/src/main/java/...`, `AndroidManifest.xml`,
`variables.gradle`, resource dirs, etc.; those are preserved.

**"App keeps crashing on launch" after adding a plugin**
→ You installed the plugin's npm package but didn't run `npx cap sync
android`. The native side doesn't know about it yet. Also verify the
plugin's `minSdkVersion` doesn't exceed your device's Android version.

**Release build works but debug is unbearably slow / laggy on emulator**
→ Use a hardware‑accelerated x86_64 emulator image (not ARM) and enable
`Graphics: Hardware - GLES 2.0` in AVD settings. Or just plug in a real
phone — always faster than an emulator on Windows.

---

## 6. Everyday commands cheat‑sheet

| Task | Command |
|---|---|
| Dev server (web) | `npm run dev` |
| Type‑check + build (web) | `npm run build` |
| Preview production build | `npm run preview` |
| Lint | `npm run lint` |
| Run tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Build & open Android Studio | `npm run cap:android` |
| Build & run on device/emulator | `npm run cap:run:android` |
| Copy fresh web build into `android/` (no rebuild) | `npx cap sync android` |
| Add Android platform (first time only) | `npx cap add android` |
| List connected devices | `adb devices` |

---

## 7. Project layout (short version)

```
expense-manager/
├── src/                       # React app (TS + Vite + Tailwind)
│   ├── app/router.tsx         # Routes (lazyWithRetry-wrapped)
│   ├── features/              # Feature modules (transactions, stocks, ...)
│   ├── shared/
│   │   ├── components/        # UI primitives, Layout, BottomNav, ...
│   │   ├── hooks/             # usePullToRefresh, useKeyboardShortcuts, ...
│   │   └── services/          # haptics, nativeShell, platform, db, ...
│   ├── main.tsx               # Entry point; bootstrapNativeShell() runs here
│   └── index.css              # Tailwind + theme tokens
├── public/                    # Static assets (icons, manifest, prices.json)
├── scripts/                   # Build-time scripts (sitemap, price fetch, ...)
├── dist/                      # Build output (git-ignored)
├── android/                   # Generated by `cap add android` (git-ignored)
├── capacitor.config.ts        # Mobile shell config (appId, splash, status bar)
├── vite.config.ts             # Vite + PWA + chunk splitting config
└── package.json
```
