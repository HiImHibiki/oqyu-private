#!/bin/zsh
# Membangun "Exact Worksheet Bar.app" dari satu berkas Swift.
# Cukup Command Line Tools — tidak perlu Xcode maupun SwiftPM.
set -e
cd "$(dirname "$0")"
NAMA="Exact Worksheet Bar"
APP="dist/$NAMA.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O MenuBar.swift -o "$APP/Contents/MacOS/ExactWorksheetBar"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Exact Worksheet Bar</string>
  <key>CFBundleIdentifier</key><string>com.exactcourse.worksheetbar</string>
  <key>CFBundleExecutable</key><string>ExactWorksheetBar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST

codesign --force --deep --sign - "$APP" 2>/dev/null || true
print -r -- "Selesai: $APP"
