#!/usr/bin/env bun
/**
 * Build script for The Seer PDF Generator
 *
 * Usage:
 *   bun run build.ts                          # Build for current platform
 *   bun run build.ts --target darwin-arm64     # Cross-compile for macOS ARM
 *   bun run build.ts --target darwin-x64       # Cross-compile for macOS Intel
 *   bun run build.ts --target win-x64          # Cross-compile for Windows
 *   bun run build.ts --all                     # Build all platforms
 */

import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dir;
const DIST = join(ROOT, 'dist');
const TEMPLATE = join(ROOT, 'GEN', 'GEN-V3.tex');

type Target = {
  name: string;
  bunTarget: string;
  binaryName: string;
  archiveName: string;
  installerName: string;
};

const TARGETS: Record<string, Target> = {
  'darwin-arm64': {
    name: 'macOS (Apple Silicon)',
    bunTarget: 'bun-darwin-arm64',
    binaryName: 'theseer-pdf',
    archiveName: 'theseer-pdf-macos-arm64',
    installerName: 'install.sh',
  },
  'darwin-x64': {
    name: 'macOS (Intel)',
    bunTarget: 'bun-darwin-x64',
    binaryName: 'theseer-pdf',
    archiveName: 'theseer-pdf-macos-x64',
    installerName: 'install.sh',
  },
  'win-x64': {
    name: 'Windows (x64)',
    bunTarget: 'bun-windows-x64',
    binaryName: 'theseer-pdf.exe',
    archiveName: 'theseer-pdf-windows-x64',
    installerName: 'install.bat',
  },
};

function buildTarget(target: Target) {
  const archiveDir = join(DIST, target.archiveName);
  const templatesDir = join(archiveDir, 'templates');

  console.log(`\nBuilding for ${target.name}...`);

  // Create archive directory
  mkdirSync(templatesDir, { recursive: true });

  // Compile binary
  const outFile = join(archiveDir, target.binaryName);
  execSync(
    `bun build --compile --target=${target.bunTarget} ${join(ROOT, 'main.ts')} --outfile "${outFile}"`,
    { stdio: 'inherit' }
  );

  // Copy template
  copyFileSync(TEMPLATE, join(templatesDir, 'default.tex'));

  // Create platform-specific installer
  if (target.installerName === 'install.sh') {
    createMacInstaller(archiveDir);
  } else {
    createWindowsInstaller(archiveDir);
  }

  console.log(`  Archive: ${archiveDir}/`);

  // Create tar.gz (macOS) or zip (Windows) — skip with --no-archive (CI handles its own packaging)
  if (!noArchive) {
    if (target.binaryName.endsWith('.exe')) {
      execSync(`cd "${DIST}" && zip -r "${target.archiveName}.zip" "${target.archiveName}"`, { stdio: 'pipe' });
      console.log(`  Package: ${join(DIST, target.archiveName + '.zip')}`);
    } else {
      execSync(`cd "${DIST}" && tar czf "${target.archiveName}.tar.gz" "${target.archiveName}"`, { stdio: 'pipe' });
      console.log(`  Package: ${join(DIST, target.archiveName + '.tar.gz')}`);
    }
  }
}

function createMacInstaller(dir: string) {
  const script = `#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_ID="\${1:-}"

echo ""
echo "The Seer — Resume PDF Generator Installer"
echo "==========================================="
echo ""

# Run the binary's built-in setup
if [ -n "$EXT_ID" ]; then
  "$SCRIPT_DIR/theseer-pdf" --setup "$EXT_ID"
else
  "$SCRIPT_DIR/theseer-pdf" --setup
fi

# Copy tectonic if bundled
if [ -f "$SCRIPT_DIR/tectonic" ]; then
  cp "$SCRIPT_DIR/tectonic" "$HOME/.theseer/bin/tectonic"
  chmod +x "$HOME/.theseer/bin/tectonic"
  echo "[theseer-pdf] Tectonic bundled binary installed."
fi

echo ""
echo "Installation complete! Restart Chrome to activate."
echo ""
echo "Test it:  ~/.theseer/bin/theseer-pdf --help"
echo ""
`;
  const path = join(dir, 'install.sh');
  writeFileSync(path, script, 'utf-8');
  chmodSync(path, 0o755);
}

function createWindowsInstaller(dir: string) {
  const script = `@echo off
setlocal

echo.
echo The Seer - Resume PDF Generator Installer
echo ===========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "EXT_ID=%~1"

rem Run the binary's built-in setup
if "%EXT_ID%"=="" (
  "%SCRIPT_DIR%theseer-pdf.exe" --setup
) else (
  "%SCRIPT_DIR%theseer-pdf.exe" --setup %EXT_ID%
)

rem Copy tectonic if bundled
if exist "%SCRIPT_DIR%tectonic.exe" (
  copy /Y "%SCRIPT_DIR%tectonic.exe" "%LOCALAPPDATA%\\TheSeer\\bin\\tectonic.exe" >nul
  echo [theseer-pdf] Tectonic bundled binary installed.
)

echo.
echo Installation complete! Restart Chrome to activate.
echo.
echo Test it:  "%LOCALAPPDATA%\\TheSeer\\bin\\theseer-pdf.exe" --help
echo.

pause
`;
  writeFileSync(join(dir, 'install.bat'), script.replace(/\n/g, '\r\n'), 'utf-8');
}

// Parse args
const buildArgs = process.argv.slice(2);
const noArchive = buildArgs.includes('--no-archive');
const buildAll = buildArgs.includes('--all');
const targetArg = buildArgs.find(a => a !== '--all' && !a.startsWith('--'));
const targetFlag = buildArgs[buildArgs.indexOf('--target') + 1];
const selectedTarget = targetArg || targetFlag;

if (buildAll) {
  mkdirSync(DIST, { recursive: true });
  for (const target of Object.values(TARGETS)) {
    buildTarget(target);
  }
  console.log(`\nAll builds complete in ${DIST}/`);
} else if (selectedTarget && TARGETS[selectedTarget]) {
  mkdirSync(DIST, { recursive: true });
  buildTarget(TARGETS[selectedTarget]);
} else {
  // Default: build for current platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const os = process.platform === 'win32' ? 'win' : 'darwin';
  const key = `${os}-${arch}`;
  if (!TARGETS[key]) {
    console.error(`Unsupported platform: ${key}`);
    process.exit(1);
  }
  mkdirSync(DIST, { recursive: true });
  buildTarget(TARGETS[key]);
}
