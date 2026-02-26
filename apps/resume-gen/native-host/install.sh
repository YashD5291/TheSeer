#!/bin/bash
#
# Install The Seer Native Messaging Host for Chrome
#
# Usage: ./install.sh <extension-id>
#   e.g. ./install.sh abcdefghijklmnopqrstuvwxyz123456

set -e

EXTENSION_ID="$1"

if [ -z "$EXTENSION_ID" ]; then
  echo "Usage: $0 <extension-id>"
  echo "  Find your extension ID at chrome://extensions (enable Developer mode)"
  exit 1
fi

HOST_NAME="com.theseer.resumegen"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/seer-resume-host.sh"

# Chrome native messaging hosts directory (macOS)
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

mkdir -p "$MANIFEST_DIR"

# Write the manifest
cat > "$MANIFEST_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "The Seer - Resume PDF Generator",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

# Ensure host script is executable
chmod +x "$HOST_SCRIPT"

echo "Installed native messaging host: $HOST_NAME"
echo "  Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "  Host:     $HOST_SCRIPT"
echo "  Extension: $EXTENSION_ID"
echo ""
echo "Restart Chrome after installing."
