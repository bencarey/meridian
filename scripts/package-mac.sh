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
# The DMG is still styled to match electron-builder.yml's `dmg:` block (background,
# window size, icon positions) — via a Finder/AppleScript pass on a temporary
# read-write image, done *after* the app is already signed. Finder touching an
# already-signed app doesn't re-trigger the provenance problem above, since nothing
# re-signs it afterward.

set -euo pipefail
cd "$(dirname "$0")/.."

PRODUCT="Meridian"
VERSION="$(node -p "require('./package.json').version")"
VOL_NAME="${PRODUCT} ${VERSION}"
ENTITLEMENTS="build/entitlements.mac.plist"
APP_OUT="dist/mac-arm64/${PRODUCT}.app"
DMG="dist/${PRODUCT}-${VERSION}.dmg"
BACKGROUND="build/dmg_background.png"
WINDOW_W=540
WINDOW_H=380
APP_X=150
APP_Y=190
APPLINK_X=390
APPLINK_Y=190
ICON_SIZE=96

WORK_DIR="$(mktemp -d)"
STAGE_DIR="$(mktemp -d)"
WORK_APP="${WORK_DIR}/${PRODUCT}.app"
RW_DMG="${WORK_DIR}/${PRODUCT}-rw.dmg"
DEVICE=""
cleanup() {
  if [ -n "$DEVICE" ]; then hdiutil detach "$DEVICE" -quiet 2>/dev/null || true; fi
  rm -rf "$WORK_DIR" "$STAGE_DIR"
}
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

echo "▸ Assembling styled DMG (Finder-arranged, hdiutil)…"
cp -R "$WORK_APP" "$STAGE_DIR/"
ln -s /Applications "$STAGE_DIR/Applications"
mkdir "$STAGE_DIR/.background"
cp "$BACKGROUND" "$STAGE_DIR/.background/background.png"

hdiutil create -volname "$VOL_NAME" -srcfolder "$STAGE_DIR" -ov -fs HFS+ -format UDRW -size 300m "$RW_DMG" >/dev/null

## hdiutil auto-mounts under /Volumes/<volname> here — an explicit -mountpoint
## makes Finder display the mountpoint dir's basename instead of the volume
## label, which breaks `tell disk "$VOL_NAME"` below.
ATTACH_OUT="$(hdiutil attach "$RW_DMG" -noautoopen)"
DEVICE="$(echo "$ATTACH_OUT" | grep -Eo '/dev/disk[0-9]+' | head -1)"
sleep 1

WINDOW_RIGHT=$((100 + WINDOW_W))
WINDOW_BOTTOM=$((100 + WINDOW_H))

osascript <<APPLESCRIPT
tell application "Finder"
  tell disk "${VOL_NAME}"
    open
    delay 1
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {100, 100, ${WINDOW_RIGHT}, ${WINDOW_BOTTOM}}
    set theViewOptions to the icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to ${ICON_SIZE}
    set background picture of theViewOptions to file ".background:background.png"
    set position of item "${PRODUCT}.app" of container window to {${APP_X}, ${APP_Y}}
    set position of item "Applications" of container window to {${APPLINK_X}, ${APPLINK_Y}}
    update without registering applications
    delay 2
    close
  end tell
end tell
APPLESCRIPT

hdiutil detach "$DEVICE" -quiet
DEVICE=""

rm -f "$DMG"
hdiutil convert "$RW_DMG" -format UDZO -ov -o "$DMG" >/dev/null

# Leave a signed app in dist/mac-arm64 too (handy for local install).
rm -rf "$APP_OUT"
cp -R "$WORK_APP" "$APP_OUT"

echo "✓ ${DMG} ($(du -h "$DMG" | cut -f1)) — signed:"
codesign --verify --verbose=1 "$APP_OUT" 2>&1 | sed 's/^/    /'
