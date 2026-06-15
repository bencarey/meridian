#!/usr/bin/env bash
#
# Package Meridian for macOS (Apple silicon) into an ad-hoc-signed DMG.
#
# Why this exists instead of a plain `electron-builder --mac`:
#   macOS 14.4+ stamps an unremovable `com.apple.provenance` xattr onto binaries
#   inside any .app bundle LaunchServices has already seen. `codesign` then rejects
#   them with "resource fork, Finder information, or similar detritus not allowed",
#   and the attribute can't be cleared in place (`xattr -c`/`-d` are no-ops for it).
#   electron-builder signs the app in its output bundle path, so it hits this wall
#   on any machine where Meridian has been launched.
#
#   The fix: pack the app unsigned, copy it to a path *outside* the registered
#   bundle with forks/xattrs stripped (`ditto --norsrc --noextattr`), sign it there
#   (the stripped copy signs cleanly), then build the DMG from that copy.
#   Ref: https://github.com/electron-userland/electron-builder/issues/8149
#
# Note: this produces a functional drag-to-Applications DMG via hdiutil; it does
# not use electron-builder's custom DMG background (that path requires signing to
# succeed in the bundle, which is exactly what fails here).

set -euo pipefail
cd "$(dirname "$0")/.."

PRODUCT="Meridian"
VERSION="$(node -p "require('./package.json').version")"
ENTITLEMENTS="build/entitlements.mac.plist"
APP_OUT="dist/mac-arm64/${PRODUCT}.app"
DMG="dist/${PRODUCT}-${VERSION}.dmg"

WORK_DIR="$(mktemp -d)"
STAGE_DIR="$(mktemp -d)"
WORK_APP="${WORK_DIR}/${PRODUCT}.app"
cleanup() { rm -rf "$WORK_DIR" "$STAGE_DIR"; }
trap cleanup EXIT

echo "▸ Compiling (electron-vite build)…"
npx electron-vite build

echo "▸ Packing app unsigned (electron-builder --dir)…"
rm -rf dist
npx electron-builder --dir -c.mac.identity=null

echo "▸ Stripping resource forks / xattrs into a clean path…"
ditto --norsrc --noextattr --noqtn "$APP_OUT" "$WORK_APP"

echo "▸ Ad-hoc signing the stripped copy…"
codesign --deep --force --options runtime --entitlements "$ENTITLEMENTS" --sign - "$WORK_APP"
codesign --verify --deep --strict --verbose=1 "$WORK_APP"

echo "▸ Assembling DMG (hdiutil)…"
cp -R "$WORK_APP" "$STAGE_DIR/"
ln -s /Applications "$STAGE_DIR/Applications"
rm -f "$DMG"
hdiutil create -volname "${PRODUCT} ${VERSION}" -srcfolder "$STAGE_DIR" -ov -format UDZO "$DMG" >/dev/null

# Leave a signed app in dist/mac-arm64 too (handy for local install).
rm -rf "$APP_OUT"
cp -R "$WORK_APP" "$APP_OUT"

echo "✓ ${DMG} ($(du -h "$DMG" | cut -f1)) — signed:"
codesign --verify --verbose=1 "$APP_OUT" 2>&1 | sed 's/^/    /'
