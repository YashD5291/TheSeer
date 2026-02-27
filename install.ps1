# The Seer — Windows Installer
# Run: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"
$REPO = "YashD5291/TheSeer"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

function Print-Step($num, $msg) { Write-Host "`n[$num/6] $msg" -ForegroundColor Cyan }
function Print-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Print-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Print-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "The Seer — Installer" -ForegroundColor White
Write-Host "AI-powered resume tailoring from your browser" -ForegroundColor DarkGray
Write-Host ""

# ─── Step 1: Prerequisites ───────────────────────────────────────────
Print-Step 1 "Checking prerequisites"

$missing = @()

try {
    $nodeVer = (node -v 2>$null)
    if ($nodeVer) {
        $major = [int]($nodeVer -replace 'v','').Split('.')[0]
        if ($major -ge 18) {
            Print-Ok "Node.js $nodeVer"
        } else {
            Print-Err "Node.js $nodeVer (need >= 18)"
            $missing += "node"
        }
    } else { throw }
} catch {
    Print-Err "Node.js not found"
    $missing += "node"
}

try {
    $pnpmVer = (pnpm -v 2>$null)
    if ($pnpmVer) { Print-Ok "pnpm $pnpmVer" } else { throw }
} catch {
    Print-Err "pnpm not found"
    $missing += "pnpm"
}

try {
    $bunVer = (bun -v 2>$null)
    if ($bunVer) { Print-Ok "bun $bunVer" } else { throw }
} catch {
    Print-Warn "bun not found (needed for PDF generator — can skip for now)"
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing required tools: $($missing -join ', ')" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install them:"
    foreach ($tool in $missing) {
        switch ($tool) {
            "node" { Write-Host "  winget install OpenJS.NodeJS   # or: https://nodejs.org" }
            "pnpm" { Write-Host "  npm install -g pnpm" }
        }
    }
    Write-Host ""
    exit 1
}

# ─── Step 2: Install dependencies ────────────────────────────────────
Print-Step 2 "Installing dependencies"

Set-Location $SCRIPT_DIR
try { pnpm install --frozen-lockfile 2>$null } catch { pnpm install }
Print-Ok "Dependencies installed"

# ─── Step 3: Build extension ─────────────────────────────────────────
Print-Step 3 "Building extension"

Set-Location "$SCRIPT_DIR\apps\extension"
node build.mjs
Print-Ok "Extension built at apps\extension\"

# ─── Step 4: Load extension in Chrome ─────────────────────────────────
Print-Step 4 "Load extension in Chrome"

Write-Host ""
Write-Host "  Open Chrome and do the following:" -ForegroundColor White
Write-Host ""
Write-Host "    1. Go to  chrome://extensions"
Write-Host "    2. Enable Developer mode (top right toggle)" -ForegroundColor White
Write-Host "    3. Click  Load unpacked" -ForegroundColor White
Write-Host "    4. Select this folder:"
Write-Host "       $SCRIPT_DIR\apps\extension" -ForegroundColor DarkGray
Write-Host "    5. Copy the Extension ID shown under the extension name" -ForegroundColor White
Write-Host ""

while ($true) {
    $ext_id = Read-Host "  Paste your Extension ID"
    $ext_id = $ext_id.Trim()
    if ($ext_id -match '^[a-z]{32}$') {
        Print-Ok "Extension ID: $ext_id"
        break
    } else {
        Print-Err "Invalid ID — should be 32 lowercase letters"
    }
}

# ─── Step 5: Output directory ────────────────────────────────────────
Print-Step 5 "Choose output directory"

$default_output = Join-Path $HOME "Resumes"
Write-Host ""
Write-Host "  Where should generated resume PDFs be saved?"
$output_dir = Read-Host "  Output directory [$default_output]"
if ([string]::IsNullOrWhiteSpace($output_dir)) { $output_dir = $default_output }

$output_dir = [System.IO.Path]::GetFullPath($output_dir)
New-Item -ItemType Directory -Path $output_dir -Force | Out-Null
Print-Ok "Output directory: $output_dir"

# ─── Step 6: Install PDF generator ───────────────────────────────────
Print-Step 6 "Installing PDF generator"

$platform_suffix = "windows-x64"
$artifact = "theseer-pdf-$platform_suffix"
$archive = "$artifact.zip"
$install_dir = Join-Path $env:LOCALAPPDATA "TheSeer"
$tmp_dir = Join-Path $env:TEMP "theseer-install-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp_dir -Force | Out-Null

Write-Host "  Fetching latest release..." -ForegroundColor DarkGray
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$REPO/releases/latest"
    $asset = $release.assets | Where-Object { $_.name -eq $archive } | Select-Object -First 1

    if (-not $asset) {
        Print-Warn "Could not find release for $platform_suffix"
        Print-Warn "Install manually: https://github.com/$REPO/releases"
    } else {
        $download_url = $asset.browser_download_url
        Write-Host "  Downloading $archive..." -ForegroundColor DarkGray
        Invoke-WebRequest -Uri $download_url -OutFile "$tmp_dir\$archive"

        Expand-Archive -Path "$tmp_dir\$archive" -DestinationPath $tmp_dir -Force

        # Run setup
        $binary = "$tmp_dir\$artifact\theseer-pdf.exe"
        & $binary --setup $ext_id --output-dir $output_dir

        # Copy tectonic if bundled
        $tectonic = "$tmp_dir\$artifact\tectonic.exe"
        if (Test-Path $tectonic) {
            $binDir = Join-Path $install_dir "bin"
            Copy-Item $tectonic (Join-Path $binDir "tectonic.exe") -Force
            Print-Ok "Tectonic PDF compiler installed"
        }

        Print-Ok "PDF generator installed"
    }
} catch {
    Print-Warn "Failed to download release: $_"
    Print-Warn "Install manually: https://github.com/$REPO/releases"
}

Remove-Item -Recurse -Force $tmp_dir -ErrorAction SilentlyContinue

# ─── Done ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "    1. Restart Chrome (required for native messaging)" -ForegroundColor White
Write-Host ""
Write-Host "    2. Import your profile" -ForegroundColor White
Write-Host "       Click the Seer extension icon → Settings"
Write-Host "       Drag your seer-profile-export.json into the import area"
Write-Host ""
Write-Host "    3. Try it out" -ForegroundColor White
Write-Host "       Visit any job posting → click the S button (bottom right)"
Write-Host ""
Write-Host "  Resumes will be saved to: $output_dir" -ForegroundColor DarkGray
Write-Host "  Change anytime: $install_dir\bin\theseer-pdf.exe --set-output C:\new\path" -ForegroundColor DarkGray
Write-Host ""
