// Strips extended attributes (notably `com.apple.provenance`, which macOS 14.4+
// auto-adds to freshly written binaries) from the packed .app before electron-builder
// code-signs it. Without this, ad-hoc codesign fails with:
//   "resource fork, Finder information, or similar detritus not allowed"
// afterPack runs after the app is assembled but before signing, so this is the right hook.
const { execSync } = require('node:child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`
  execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })
}
