#!/bin/zsh
# Membangun APK tanpa Gradle — cukup Android SDK + JDK dari Android Studio.
set -e
cd "$(dirname "$0")"
SDK="$HOME/Library/Android/sdk"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
PLAT="$SDK/platforms/$(ls "$SDK/platforms" | grep -E 'android-3[0-9]$' | sort -V | tail -1)"
JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
JAVAC="$JAVA_HOME/bin/javac"
# d8, zipalign, dan apksigner adalah skrip pembungkus yang memanggil `java`
# dari PATH — tanpa ini gagal "Unable to locate a Java Runtime".
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

print -r -- "SDK      : $BT"
print -r -- "platform : $(basename "$PLAT")"

rm -rf build && mkdir -p build/res build/gen build/kelas

# 1. sumber daya
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/dasar.apk -I "$PLAT/android.jar" \
  --manifest AndroidManifest.xml --java build/gen --auto-add-overlay build/res.zip

# 2. kode
# --release dipakai, bukan -source/-target + -bootclasspath: JDK baru menolak
# gabungan itu. android.jar tetap di classpath supaya API Android dikenali.
"$JAVAC" --release 17 -nowarn -classpath "$PLAT/android.jar" -d build/kelas \
  $(find src build/gen -name '*.java')

# 3. dex
"$BT/d8" --lib "$PLAT/android.jar" --output build \
  $(find build/kelas -name '*.class')

# 4. bungkus + tanda tangan
cd build && cp dasar.apk taktertata.apk && zip -q taktertata.apk classes.dex && cd ..
"$BT/zipalign" -f 4 build/taktertata.apk build/rata.apk

KS="$HOME/.android/debug.keystore"
if [[ ! -f "$KS" ]]; then
  mkdir -p "$HOME/.android"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -storepass android \
    -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 \
    -validity 10000 -dname "CN=Exact Worksheet" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey --out ExactWorksheet.apk build/rata.apk

print -r -- "Selesai: $(pwd)/ExactWorksheet.apk ($(du -h ExactWorksheet.apk | cut -f1))"
