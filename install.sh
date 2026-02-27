#!/bin/bash
set -e

# ─── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

REPO="YashD5291/TheSeer"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

print_step() { echo -e "\n${BLUE}${BOLD}[$1/6]${RESET} ${BOLD}$2${RESET}"; }
print_ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
print_warn() { echo -e "  ${YELLOW}!${RESET} $1"; }
print_err()  { echo -e "  ${RED}✗${RESET} $1"; }

# ─── Header ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}The Seer — Installer${RESET}"
echo -e "${DIM}AI-powered resume tailoring from your browser${RESET}"
echo ""

# ─── Step 1: Prerequisites ───────────────────────────────────────────
print_step 1 "Checking prerequisites"

missing=()

if command -v node &>/dev/null; then
  node_ver=$(node -v | sed 's/v//')
  node_major=$(echo "$node_ver" | cut -d. -f1)
  if [ "$node_major" -ge 18 ]; then
    print_ok "Node.js $node_ver"
  else
    print_err "Node.js $node_ver (need >= 18)"
    missing+=("node")
  fi
else
  print_err "Node.js not found"
  missing+=("node")
fi

if command -v pnpm &>/dev/null; then
  print_ok "pnpm $(pnpm -v)"
else
  print_err "pnpm not found"
  missing+=("pnpm")
fi

if command -v bun &>/dev/null; then
  print_ok "bun $(bun -v)"
else
  print_warn "bun not found (needed for PDF generator — can skip for now)"
fi

if [ ${#missing[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}Missing required tools: ${missing[*]}${RESET}"
  echo ""
  echo "Install them:"
  for tool in "${missing[@]}"; do
    case $tool in
      node)
        case "$(uname -s)" in
          Darwin) echo "  brew install node              # or: https://nodejs.org" ;;
          Linux)  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs" ;;
        esac
        ;;
      pnpm)
        echo "  npm install -g pnpm"
        ;;
    esac
  done
  echo ""
  exit 1
fi

# ─── Step 2: Install dependencies ────────────────────────────────────
print_step 2 "Installing dependencies"

cd "$SCRIPT_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
print_ok "Dependencies installed"

# ─── Step 3: Build extension ─────────────────────────────────────────
print_step 3 "Building extension"

cd "$SCRIPT_DIR/apps/extension"
node build.mjs
print_ok "Extension built at apps/extension/"

# ─── Step 4: Load extension in Chrome ─────────────────────────────────
print_step 4 "Load extension in Chrome"

echo ""
echo -e "  ${BOLD}Open Chrome and do the following:${RESET}"
echo ""
echo "    1. Go to  chrome://extensions"
echo "    2. Enable ${BOLD}Developer mode${RESET} (top right toggle)"
echo "    3. Click  ${BOLD}Load unpacked${RESET}"
echo "    4. Select this folder:"
echo -e "       ${DIM}$SCRIPT_DIR/apps/extension${RESET}"
echo "    5. Copy the ${BOLD}Extension ID${RESET} shown under the extension name"
echo ""

while true; do
  read -rp "  Paste your Extension ID: " ext_id
  ext_id=$(echo "$ext_id" | tr -d '[:space:]')
  if [[ "$ext_id" =~ ^[a-z]{32}$ ]]; then
    print_ok "Extension ID: $ext_id"
    break
  else
    print_err "Invalid ID — should be 32 lowercase letters (e.g. abcdefghijklmnopqrstuvwxyzabcdef)"
  fi
done

# ─── Step 5: Output directory ────────────────────────────────────────
print_step 5 "Choose output directory"

default_output="$HOME/Resumes"
echo ""
echo "  Where should generated resume PDFs be saved?"
read -rp "  Output directory [$default_output]: " output_dir
output_dir="${output_dir:-$default_output}"

# Expand ~ if user typed it
output_dir="${output_dir/#\~/$HOME}"
output_dir="$(cd "$(dirname "$output_dir")" 2>/dev/null && pwd)/$(basename "$output_dir")" 2>/dev/null || output_dir="$output_dir"

mkdir -p "$output_dir"
print_ok "Output directory: $output_dir"

# ─── Step 6: Install PDF generator ───────────────────────────────────
print_step 6 "Installing PDF generator"

# Detect platform
os_name=$(uname -s)
arch=$(uname -m)

case "$os_name" in
  Darwin)
    case "$arch" in
      arm64)  platform_suffix="macos-arm64" ;;
      x86_64) platform_suffix="macos-x64" ;;
      *)      platform_suffix="" ;;
    esac
    install_dir="$HOME/.theseer"
    ;;
  Linux)
    case "$arch" in
      x86_64)       platform_suffix="linux-x64" ;;
      aarch64|arm64) platform_suffix="linux-arm64" ;;
      *)            platform_suffix="" ;;
    esac
    install_dir="$HOME/.theseer"
    ;;
  *)
    platform_suffix=""
    ;;
esac

if [ -z "$platform_suffix" ]; then
  print_err "Unsupported platform: $os_name $arch"
  print_warn "Install manually: https://github.com/$REPO/releases"
else
  artifact="theseer-pdf-${platform_suffix}"
  archive="${artifact}.tar.gz"
  tmp_dir=$(mktemp -d)

  # Get latest release download URL
  echo -e "  ${DIM}Fetching latest release...${RESET}"
  download_url=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep "browser_download_url.*${archive}" \
    | head -1 \
    | cut -d '"' -f 4)

  if [ -z "$download_url" ]; then
    print_warn "Could not find release for $platform_suffix"
    print_warn "You can install manually: https://github.com/$REPO/releases"
  else
    echo -e "  ${DIM}Downloading $archive...${RESET}"
    curl -fsSL -o "$tmp_dir/$archive" "$download_url"
    tar xzf "$tmp_dir/$archive" -C "$tmp_dir"

    # Run setup
    chmod +x "$tmp_dir/$artifact/theseer-pdf"
    "$tmp_dir/$artifact/theseer-pdf" --setup "$ext_id" --output-dir "$output_dir"

    # Copy tectonic if bundled
    if [ -f "$tmp_dir/$artifact/tectonic" ]; then
      cp "$tmp_dir/$artifact/tectonic" "$install_dir/bin/tectonic"
      chmod +x "$install_dir/bin/tectonic"
      print_ok "Tectonic PDF compiler installed"
    fi

    rm -rf "$tmp_dir"
    print_ok "PDF generator installed"
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo ""
echo "    1. ${BOLD}Restart Chrome${RESET} (required for native messaging)"
echo ""
echo "    2. ${BOLD}Import your profile${RESET}"
echo "       Click the Seer extension icon → Settings"
echo "       Drag your seer-profile-export.json into the import area"
echo ""
echo "    3. ${BOLD}Try it out${RESET}"
echo "       Visit any job posting → click the S button (bottom right)"
echo ""
echo -e "  ${DIM}Resumes will be saved to: $output_dir${RESET}"
echo -e "  ${DIM}Change anytime: ${install_dir:-~/.theseer}/bin/theseer-pdf --set-output /new/path${RESET}"
echo ""
