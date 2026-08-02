#!/usr/bin/env bash
#
# Capture Google Play phone screenshots from a connected Android device/emulator.
#
# Play requirements (phone): 2–8 images, PNG or JPEG, 16:9 or 9:16,
# each side 320–3840 px. A 1080x1920 / 1080x2400 portrait device is ideal.
#
# Usage:
#   1. Start an emulator (or plug in a phone with USB debugging on) and install MoneyIQ:
#        cd expense-manager/android && ./gradlew installDebug
#   2. Run:  bash scripts/capture-screenshots.sh
#   3. For each prompt, navigate the app to that screen, then press Enter.
#
# Output: playstore/assets/screenshots/*.png (git-ignored by default).
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/playstore/assets/screenshots"
mkdir -p "$OUT_DIR"

if ! command -v adb >/dev/null 2>&1; then
  echo "✗ adb not found. Install with: brew install --cask android-commandlinetools" >&2
  exit 1
fi

if [ "$(adb get-state 2>/dev/null)" != "device" ]; then
  echo "✗ No Android device/emulator detected. Start an emulator or connect a phone (USB debugging on)." >&2
  echo "  Check with: adb devices" >&2
  exit 1
fi

# The store-listing screens we want (order = order shown on Play).
SCREENS=(
  "01-dashboard:Dashboard with balances + this month spend"
  "02-add-transaction:Add transaction (category + account picker)"
  "03-analytics:Analytics — category breakdown or trends"
  "04-budgets:Budgets with progress bars"
  "05-reports:Monthly report"
  "06-stocks:Stock portfolio (holdings + P&L)"
)

echo "Capturing ${#SCREENS[@]} screenshots to: $OUT_DIR"
echo "Tip: hide any real personal data first (use demo values)."
echo

for entry in "${SCREENS[@]}"; do
  name="${entry%%:*}"
  desc="${entry#*:}"
  read -r -p "→ Navigate to: ${desc}  … then press Enter to capture (or 's' to skip): " ans
  if [ "${ans}" = "s" ]; then echo "  skipped ${name}"; continue; fi
  adb exec-out screencap -p > "$OUT_DIR/${name}.png"
  # sanity: file should be a non-trivial PNG
  if [ -s "$OUT_DIR/${name}.png" ]; then
    echo "  ✓ saved ${name}.png"
  else
    echo "  ✗ ${name}.png is empty — retry this screen." >&2
    rm -f "$OUT_DIR/${name}.png"
  fi
done

echo
echo "Done. Review images in: $OUT_DIR"
echo "Upload 4–8 of them under Play Console → Store listing → Phone screenshots."
