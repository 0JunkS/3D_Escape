#!/usr/bin/env bash
# ============================================================
# 3D Escape — Release Keystore Generator
# Run this ONCE on your local PC (not on Replit).
# Keep the generated keystore file and passwords safe —
# you will need the same key for every future Play Store update.
# ============================================================

set -e

KEYSTORE_FILE="release.keystore"
ALIAS="key0"

echo "======================================"
echo "  3D Escape — Release Keystore Setup"
echo "======================================"
echo ""

if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  $KEYSTORE_FILE already exists."
  read -r -p "Overwrite? [y/N] " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

read -r -p "Keystore password (min 6 chars): " -s STORE_PASS; echo
read -r -p "Key password     (leave blank to use same): " -s KEY_PASS; echo
KEY_PASS="${KEY_PASS:-$STORE_PASS}"

if [ ${#STORE_PASS} -lt 6 ]; then
  echo "❌ Password must be at least 6 characters."
  exit 1
fi

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=3D Escape, OU=Game, O=D3Escape, L=Seoul, S=Seoul, C=KR"

echo ""
echo "✅ Keystore saved: $KEYSTORE_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 GitHub Secrets to add (Settings → Secrets → Actions):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Secret name : RELEASE_KEYSTORE_BASE64"
echo "Value       :"
base64 -w0 "$KEYSTORE_FILE"
echo ""
echo ""
echo "Secret name : KEYSTORE_PASSWORD"
echo "Value       : $STORE_PASS"
echo ""
echo "Secret name : KEY_ALIAS"
echo "Value       : $ALIAS"
echo ""
echo "Secret name : KEY_PASSWORD"
echo "Value       : $KEY_PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Back up $KEYSTORE_FILE and these passwords."
echo "   Losing them means you can never update the app on Play Store."
