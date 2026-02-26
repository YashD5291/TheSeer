#!/bin/bash
# Wrapper for Chrome Native Messaging — sets up NVM/node PATH
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:$PATH"

DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/seer-resume-host.mjs"
