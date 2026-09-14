#!/bin/zsh
# Membangun "Exact Practice Bar.app" dari satu berkas Swift (cukup Command Line Tools).
set -e
cd "$(dirname "$0")"
NAMA="Exact Practice Bar"
APP="dist/$NAMA.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O MenuBar.swift -o "$APP/Contents/MacOS/ExactPracticeBar"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Exact Practice Bar</string>
  <key>CFBundleIdentifier</key><string>com.exactcourse.practicebar</string>
  <key>CFBundleExecutable</key><string>ExactPracticeBar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP" 2>/dev/null || true
print -r -- "Selesai: $APP"
