#!/usr/bin/env bun
/**
 * The Seer — Unified Resume PDF Generator
 *
 * Modes:
 *   1. CLI:            theseer-pdf <input.md> [--name "Folder"] [--json]
 *   2. Native host:    theseer-pdf --native-host  (Chrome native messaging protocol)
 *   3. Setup:          theseer-pdf --setup [extension-id]
 *
 * When compiled with `bun build --compile`, this is a single standalone binary
 * that bundles the resume generator + native messaging host + installer.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, unlinkSync, statSync, chmodSync } from 'node:fs';
import { readFile, writeFile, unlink, stat, mkdir } from 'node:fs/promises';
import { execSync, execFile } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir, homedir, platform } from 'node:os';

// ============================================================
// Paths — resolve relative to binary location or script dir
// ============================================================

function getBaseDir(): string {
  // When compiled with `bun build --compile`, import.meta.dir points to /$bunfs/root/
  // In that case, use the actual binary location on disk.
  const metaDir = import.meta.dir || '';
  if (metaDir.startsWith('/$bunfs') || metaDir === '') {
    const binDir = dirname(process.execPath);
    // If installed in ~/.theseer/bin/, go up to ~/.theseer/ as root
    if (binDir.endsWith('/bin') && existsSync(join(binDir, '..', 'templates'))) {
      return resolve(binDir, '..');
    }
    return binDir;
  }
  return metaDir;
}

const BASE_DIR = getBaseDir();

// Detect dev mode: running from source with GEN/ directory present
const IS_DEV = existsSync(join(BASE_DIR, 'GEN', 'GEN-V3.tex'));

// Template and output resolve differently for dev vs installed
const TEMPLATE_PATH = process.env.THESEER_TEMPLATE
  || (IS_DEV ? join(BASE_DIR, 'GEN', 'GEN-V3.tex') : join(BASE_DIR, 'templates', 'default.tex'));
const OUTPUT_BASE = process.env.THESEER_OUTPUT
  || (IS_DEV ? join(BASE_DIR, 'Experimental') : join(BASE_DIR, 'output'));
const TECTONIC_PATH = process.env.THESEER_TECTONIC
  || (existsSync(join(BASE_DIR, 'bin', 'tectonic')) ? join(BASE_DIR, 'bin', 'tectonic') : join(BASE_DIR, 'tectonic'));
const ALT_PDF_NAME = 'resume.pdf';
const TAG = '[theseer-pdf]';

// ============================================================
// Detect mode from argv
// ============================================================

const args = process.argv.slice(2);

if (args.includes('--setup')) {
  await runSetup();
} else if (args.includes('--native-host')) {
  await runNativeHost();
} else {
  await runCli();
}

// ============================================================
// MODE 1: CLI (same logic as resume-gen.mjs)
// ============================================================

async function runCli() {
  let jsonMode = false;
  let filePath: string | null = null;
  let nameOverride: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') jsonMode = true;
    else if (args[i] === '--name' && args[i + 1]) { nameOverride = args[++i]; }
    else if (args[i] === '--help' || args[i] === '-h') { printUsage(); process.exit(0); }
    else if (!filePath && !args[i].startsWith('--')) filePath = args[i];
  }

  const log = (...a: unknown[]) => { if (!jsonMode) console.log(...a); };
  const logErr = (...a: unknown[]) => { if (!jsonMode) console.error(...a); };

  try {
    // Read input
    let input: string;
    if (filePath) {
      if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
      input = readFileSync(filePath, 'utf-8');
    } else if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
      input = Buffer.concat(chunks).toString('utf-8');
    } else {
      printUsage();
      process.exit(1);
      return; // unreachable but satisfies TS
    }

    // Derive folder name
    let folderName = nameOverride || extractChatTitle(input);
    if (!folderName) {
      if (filePath) {
        folderName = filePath.replace(/\.[^.]+$/, '').replace(/.*\//, '');
      } else {
        throw new Error('No chat title found and no --name provided.');
      }
    }

    log(`${TAG} Folder: ${folderName}`);

    const resumeText = extractResumeSection(input);
    const resume = parseResume(resumeText);
    log(`${TAG} Parsed: ${resume.name} (${resume.skills.length} skills, ${resume.experience.length} exp, ${resume.education.length} edu)`);

    applyCeaserRules(resume);

    const preamble = readPreamble();
    const content = generateContent(resume);
    const latex = preamble + '\n' + content;

    const balanceErrors = validateBalance(latex);
    if (balanceErrors.length > 0) balanceErrors.forEach(e => logErr(`${TAG} Warning: ${e}`));

    const folderPath = join(OUTPUT_BASE, folderName);
    mkdirSync(folderPath, { recursive: true });

    const texPath = join(folderPath, `${folderName}.tex`);
    writeFileSync(texPath, latex, 'utf-8');
    log(`${TAG} Wrote: ${texPath}`);

    const compiled = compilePdf(texPath, folderPath, folderName, jsonMode);
    const pdfPath = compiled ? join(folderPath, `${folderName}.pdf`) : null;
    const altPdfPath = compiled ? join(folderPath, ALT_PDF_NAME) : null;

    if (jsonMode) {
      process.stdout.write(JSON.stringify({ success: compiled, folderName, folderPath, texPath, pdfPath, altPdfPath }) + '\n');
    } else if (compiled) {
      log(`\n${TAG} Done! Files at:\n  ${texPath}\n  ${pdfPath}\n  ${altPdfPath}`);
    } else {
      log(`\n${TAG} .tex created (PDF compilation skipped).\n  ${texPath}`);
    }
  } catch (err: any) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
      process.exit(1);
    }
    console.error(`${TAG} Fatal error:`, err.message);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
The Seer — Resume PDF Generator

Usage:
  theseer-pdf <input.md>                        # From file
  theseer-pdf <input.md> --name "Folder Name"   # Custom folder name
  pbpaste | theseer-pdf --name "Folder Name"    # From clipboard
  theseer-pdf <input.md> --json                 # Machine-readable JSON output
  theseer-pdf --native-host                     # Chrome native messaging mode
  theseer-pdf --setup [extension-id]            # Install native messaging host

Options:
  --name <name>       Override folder name
  --json              Output JSON to stdout
  --native-host       Run as Chrome native messaging host
  --setup [ext-id]    Register with Chrome
  --help, -h          Show this help
`);
}

// ============================================================
// MODE 2: Native Messaging Host
// ============================================================

async function runNativeHost() {
  let tempFile: string | null = null;

  try {
    const input = await readNativeMessage();

    if (!input.responseText) {
      writeNativeMessage({ success: false, error: 'Missing responseText in input' });
      process.exit(0);
    }

    tempFile = join(tmpdir(), `seer-resume-${Date.now()}.md`);
    await writeFile(tempFile, input.responseText, 'utf-8');

    // Run ourselves in CLI mode with --json
    const result = await runResumeGenSubprocess(tempFile, input.chatTitle || null);

    // Read back files for dashboard tracking
    if (result.success && result.texPath && result.pdfPath) {
      try {
        const [latexSource, pdfBuffer, pdfStat] = await Promise.all([
          readFile(result.texPath, 'utf-8'),
          readFile(result.pdfPath),
          stat(result.pdfPath),
        ]);
        result.latexSource = latexSource;
        result.pdfBase64 = pdfBuffer.toString('base64');
        result.pdfSizeBytes = pdfStat.size;
      } catch {
        // Non-fatal
      }
    }

    writeNativeMessage(result);
  } catch (err: any) {
    writeNativeMessage({ success: false, error: err.message || String(err) });
  } finally {
    if (tempFile) await unlink(tempFile).catch(() => {});
    process.exit(0);
  }
}

function readNativeMessage(): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let headerBuf: Buffer | null = null;
    let messageLength: number | null = null;
    let totalRead = 0;

    process.stdin.on('readable', function onReadable() {
      while (true) {
        if (headerBuf === null) {
          const header = process.stdin.read(4);
          if (!header) return;
          headerBuf = header;
          messageLength = header.readUInt32LE(0);
          if (messageLength === 0) {
            process.stdin.removeListener('readable', onReadable);
            resolve({});
            return;
          }
        }
        const remaining = messageLength! - totalRead;
        const chunk = process.stdin.read(remaining);
        if (!chunk) return;
        chunks.push(chunk);
        totalRead += chunk.length;
        if (totalRead >= messageLength!) {
          process.stdin.removeListener('readable', onReadable);
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
          } catch (e: any) {
            reject(new Error(`Failed to parse input JSON: ${e.message}`));
          }
          return;
        }
      }
    });
    process.stdin.on('end', () => { if (messageLength === null) reject(new Error('No input received')); });
    setTimeout(() => reject(new Error('Timeout reading input')), 5000);
  });
}

function writeNativeMessage(obj: any) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

function runResumeGenSubprocess(tempFile: string, chatTitle: string | null): Promise<any> {
  return new Promise((resolve, reject) => {
    const execPath = process.execPath;
    const cliArgs = [tempFile, '--json'];
    if (chatTitle) cliArgs.push('--name', chatTitle);

    // If running as compiled binary, call ourselves. If as script, call with bun/node.
    const isCompiled = !execPath.includes('node') && !execPath.includes('bun');
    const cmd = isCompiled ? execPath : process.argv[1];
    const spawnArgs = isCompiled ? cliArgs : [cmd, ...cliArgs];
    const spawnCmd = isCompiled ? execPath : execPath;

    execFile(spawnCmd, isCompiled ? cliArgs : [cmd, ...cliArgs], {
      env: {
        ...process.env,
        PATH: [dirname(TECTONIC_PATH), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH].join(':'),
        THESEER_TEMPLATE: TEMPLATE_PATH,
        THESEER_OUTPUT: OUTPUT_BASE,
        THESEER_TECTONIC: TECTONIC_PATH,
      },
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        try { resolve(JSON.parse(stdout.trim())); return; } catch {}
        reject(new Error(stderr || error.message));
        return;
      }
      try { resolve(JSON.parse(stdout.trim())); }
      catch { reject(new Error(`Invalid JSON output: ${stdout.slice(0, 200)}`)); }
    });
  });
}

// ============================================================
// MODE 3: Setup / Install
// ============================================================

async function runSetup() {
  const extensionId = args.find(a => a !== '--setup' && !a.startsWith('--')) || '';
  const os = platform();

  console.log(`${TAG} Setting up The Seer PDF Generator...`);
  console.log(`${TAG} Platform: ${os}`);

  const seerDir = os === 'win32'
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'TheSeer')
    : join(homedir(), '.theseer');

  // Create directories
  const binDir = join(seerDir, 'bin');
  const templatesDir = join(seerDir, 'templates');
  const outputDir = join(seerDir, 'output');
  for (const dir of [binDir, templatesDir, outputDir]) {
    mkdirSync(dir, { recursive: true });
  }

  // Copy binary to install location
  const binaryName = os === 'win32' ? 'theseer-pdf.exe' : 'theseer-pdf';
  const installedBinary = join(binDir, binaryName);
  const currentBinary = process.execPath;

  if (resolve(currentBinary) !== resolve(installedBinary)) {
    copyFileSync(currentBinary, installedBinary);
    if (os !== 'win32') chmodSync(installedBinary, 0o755);
    console.log(`${TAG} Binary installed: ${installedBinary}`);
  } else {
    console.log(`${TAG} Binary already in place: ${installedBinary}`);
  }

  // Copy tectonic if bundled alongside
  const bundledTectonic = join(BASE_DIR, os === 'win32' ? 'tectonic.exe' : 'tectonic');
  const installedTectonic = join(binDir, os === 'win32' ? 'tectonic.exe' : 'tectonic');
  if (existsSync(bundledTectonic) && resolve(bundledTectonic) !== resolve(installedTectonic)) {
    copyFileSync(bundledTectonic, installedTectonic);
    if (os !== 'win32') chmodSync(installedTectonic, 0o755);
    console.log(`${TAG} Tectonic installed: ${installedTectonic}`);
  }

  // Copy template — check installed location first, then dev GEN/ location
  const installedTemplate = join(templatesDir, 'default.tex');
  const templateSources = [
    join(BASE_DIR, 'templates', 'default.tex'),  // bundled with compiled binary
    join(BASE_DIR, 'GEN', 'GEN-V3.tex'),          // dev mode source
  ];
  const templateSource = templateSources.find(p => existsSync(p));
  if (templateSource) {
    copyFileSync(templateSource, installedTemplate);
    console.log(`${TAG} Template installed: ${installedTemplate}`);
  } else {
    console.error(`${TAG} Warning: No template found. Copy your .tex template to ${installedTemplate}`);
  }

  // Register Chrome native messaging host
  const hostName = 'com.theseer.resumegen';

  if (os === 'win32') {
    // Windows: write manifest + registry key
    const manifestPath = join(seerDir, `${hostName}.json`);
    // Need a batch wrapper since Chrome can't launch .exe with args directly for native messaging
    const wrapperPath = join(binDir, 'theseer-native-host.bat');
    writeFileSync(wrapperPath, `@echo off\r\n"${installedBinary}" --native-host\r\n`, 'utf-8');

    const manifest = {
      name: hostName,
      description: 'The Seer - Resume PDF Generator',
      path: wrapperPath,
      type: 'stdio',
      allowed_origins: extensionId ? [`chrome-extension://${extensionId}/`] : [],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    // Write registry key
    try {
      execSync(`reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
      console.log(`${TAG} Registry key written for Chrome native messaging`);
    } catch (e: any) {
      console.error(`${TAG} Failed to write registry key: ${e.message}`);
      console.error(`${TAG} You may need to run as Administrator.`);
    }

    console.log(`${TAG} Manifest: ${manifestPath}`);
  } else {
    // macOS / Linux
    // Create a shell wrapper that sets up PATH and calls the binary
    const wrapperPath = join(binDir, 'theseer-native-host.sh');
    writeFileSync(wrapperPath, [
      '#!/bin/bash',
      `export PATH="${binDir}:$PATH"`,
      `exec "${installedBinary}" --native-host`,
      '',
    ].join('\n'), 'utf-8');
    chmodSync(wrapperPath, 0o755);

    const manifestDir = os === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts')
      : join(homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');

    mkdirSync(manifestDir, { recursive: true });

    const manifest = {
      name: hostName,
      description: 'The Seer - Resume PDF Generator',
      path: wrapperPath,
      type: 'stdio',
      allowed_origins: extensionId ? [`chrome-extension://${extensionId}/`] : [],
    };
    const manifestPath = join(manifestDir, `${hostName}.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`${TAG} Shell wrapper: ${wrapperPath}`);
    console.log(`${TAG} Manifest: ${manifestPath}`);
  }

  console.log('');
  console.log(`${TAG} Setup complete!`);
  console.log(`${TAG} Install location: ${seerDir}`);
  if (!extensionId) {
    console.log(`${TAG} NOTE: No extension ID provided. Run again with your extension ID:`);
    console.log(`${TAG}   theseer-pdf --setup <extension-id>`);
    console.log(`${TAG}   Find it at chrome://extensions (enable Developer mode)`);
  }
  console.log(`${TAG} Restart Chrome after setup.`);
}

// ============================================================
// Resume Parsing & Generation (from resume-gen.mjs)
// ============================================================

function extractChatTitle(input: string): string | null {
  const match = input.match(/^#\s*CHAT TITLE\s*\n\*\*(.+?)\*\*/m);
  if (!match) return null;
  return match[1]
    .replace(/\s*[-–—]\s*Resume Analysis\s*$/i, '')
    .replace(/\s*Resume Analysis\s*$/i, '')
    .trim();
}

function extractResumeSection(input: string): string {
  const match = input.match(/## TAILORED RESUME\s*\n([\s\S]*?)(?=\n## CHANGELOG|\n---(?:\s*\n|$))/);
  if (match) return match[1].trim();
  const hasResumeMarkers = /^# .+\n/.test(input.trim()) && /## Experience/.test(input);
  if (hasResumeMarkers) return input.trim();
  throw new Error('Could not find "## TAILORED RESUME" section in input.');
}

interface Resume {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: { category: string; items: string }[];
  experience: { title: string; company: string; location: string; dateRange: string; bullets: string[] }[];
  education: { school: string; date: string; degree: string }[];
}

function parseResume(text: string): Resume {
  const resume: Resume = {
    name: '', email: '', phone: '', linkedin: '', github: '',
    summary: '', skills: [], experience: [], education: [],
  };

  const nameMatch = text.match(/^# (.+)$/m);
  if (!nameMatch) throw new Error('Could not parse name from resume (expected "# Name").');
  resume.name = nameMatch[1].trim();

  resume.email = text.match(/\*\*Email:\*\*\s*(.+)/)?.[1]?.trim().replace(/\s{2,}$/, '') || '';
  resume.phone = text.match(/\*\*Phone:\*\*\s*(.+)/)?.[1]?.trim().replace(/\s{2,}$/, '') || '';
  resume.linkedin = text.match(/\*\*LinkedIn:\*\*\s*(.+)/)?.[1]?.trim().replace(/\s{2,}$/, '') || '';
  resume.github = text.match(/\*\*GitHub:\*\*\s*(.+)/)?.[1]?.trim().replace(/\s{2,}$/, '') || '';

  const summaryMatch = text.match(/\*\*GitHub:\*\*[^\n]*\n\n([\s\S]*?)(?=\n## Skills)/);
  if (summaryMatch) {
    resume.summary = summaryMatch[1].trim();
  } else {
    const altMatch = text.match(/\*\*(?:Email|Phone|LinkedIn|GitHub):\*\*[^\n]*\n(?:\*\*(?:Email|Phone|LinkedIn|GitHub):\*\*[^\n]*\n)*\n([\s\S]*?)(?=\n## Skills)/);
    if (altMatch) resume.summary = altMatch[1].trim();
  }

  const skillsBlock = text.match(/## Skills\s*\n([\s\S]*?)(?=\n## Experience)/);
  if (skillsBlock) {
    resume.skills = skillsBlock[1].trim().split('\n')
      .filter(l => l.trim())
      .map(line => {
        const m = line.match(/\*\*(.+?):\*\*\s*(.+)/);
        return m ? { category: m[1].trim(), items: m[2].trim() } : null;
      })
      .filter((s): s is { category: string; items: string } => s !== null);
  }

  const expBlock = text.match(/## Experience\s*\n([\s\S]*?)(?=\n## Education)/);
  if (!expBlock) throw new Error('Could not find Experience section.');

  resume.experience = expBlock[1].trim()
    .split(/(?=^\*\*[^*]+\*\*\s*\|)/m)
    .filter(c => c.trim())
    .map(chunk => {
      const lines = chunk.trim().split('\n');
      const headerMatch = lines[0].match(/\*\*(.+?)\*\*\s*\|\s*(.+)/);
      if (!headerMatch) return null;
      const titlePart = headerMatch[1].trim();
      const companyPart = headerMatch[2].trim().replace(/\s{2,}$/, '');
      let company = companyPart, location = '';
      const compLocMatch = companyPart.match(/^(.+?)\s*--\s*(.+)$/);
      if (compLocMatch) { company = compLocMatch[1].trim(); location = compLocMatch[2].trim(); }
      const dateLine = (lines[1] || '').trim();
      const bullets = lines.slice(2).filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^-\s*/, '').trim());
      return { title: titlePart, company, location, dateRange: dateLine, bullets };
    })
    .filter((j): j is Resume['experience'][0] => j !== null);

  const eduBlock = text.match(/## Education\s*\n([\s\S]*?)$/);
  if (eduBlock) {
    resume.education = eduBlock[1].trim()
      .split(/(?=^\*\*)/m)
      .filter(c => c.trim())
      .map(chunk => {
        const lines = chunk.trim().split('\n').filter(l => l.trim());
        const schoolMatch = lines[0].match(/\*\*(.+?)\*\*/);
        if (!schoolMatch) return null;
        return { school: schoolMatch[1].trim(), date: (lines[1] || '').trim(), degree: (lines[2] || '').trim() };
      })
      .filter((e): e is Resume['education'][0] => e !== null);
  }

  return resume;
}

function applyCeaserRules(resume: Resume) {
  resume.experience.forEach(job => {
    if (/labelbox/i.test(job.company)) {
      job.dateRange = job.dateRange.replace(/Jul[\s-]*2025/gi, 'Oct 2025');
    }
  });
}

function escapeLatex(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/[–—]/g, '--');
}

function readPreamble(): string {
  if (!existsSync(TEMPLATE_PATH)) throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  const templateLines = readFileSync(TEMPLATE_PATH, 'utf-8').split('\n');
  const endIdx = templateLines.findIndex(l => l.includes('\\sbox\\ANDbox'));
  if (endIdx === -1) throw new Error('Cannot find preamble end marker in template');
  return templateLines.slice(0, endIdx + 1).join('\n');
}

function generateContent(resume: Resume): string {
  const I = '    ', II = '        ', III = '            ';
  const lines: string[] = [];

  lines.push(`${I}\\begin{header}`);
  lines.push(`${II}\\fontsize{22pt}{22pt}\\selectfont`);
  lines.push(`${II}\\textbf{${escapeLatex(resume.name)}}`);
  lines.push('');
  lines.push(`${II}\\vspace{6pt}`);
  lines.push('');
  lines.push(`${II}\\normalsize`);

  const phoneTel = resume.phone.replace(/[() ]/g, m => m === '(' || m === ')' ? '' : '-');
  const githubUrl = resume.github.startsWith('http') ? resume.github : `https://${resume.github}`;

  lines.push(`${II}{\\hrefWithoutArrow{mailto:${resume.email}}{${resume.email}}}`);
  lines.push(`${II}{|}`);
  lines.push(`${II}{\\hrefWithoutArrow{tel:${phoneTel}}{${escapeLatex(resume.phone)}}}`);
  lines.push(`${II}{|}`);
  lines.push(`${II}{\\hrefWithoutArrow{${githubUrl}}{${resume.github}}}`);
  lines.push(`${I}\\end{header}`);

  lines.push('');
  lines.push(`${I}\\vspace{0.3cm}`);
  lines.push('');
  lines.push(`${I}\\begin{onecolentry}`);
  lines.push(`${II}${escapeLatex(resume.summary)}`);
  lines.push(`${I}\\end{onecolentry}`);

  lines.push('');
  lines.push(`${I}\\section{Skills}`);
  lines.push('');
  resume.skills.forEach((skill, i) => {
    lines.push(`${I}\\begin{onecolentry}`);
    lines.push(`${II}\\textbf{${escapeLatex(skill.category)}:} ${escapeLatex(skill.items)}`);
    lines.push(`${I}\\end{onecolentry}`);
    if (i < resume.skills.length - 1) { lines.push(''); lines.push(`${I}\\vspace{0.15cm}`); lines.push(''); }
  });

  lines.push('');
  lines.push(`${I}\\section{Experience}`);
  lines.push('');
  resume.experience.forEach((job, i) => {
    const dateRange = job.dateRange.replace(/[–—]/g, '--');
    const companyStr = job.location ? `${escapeLatex(job.company)} -- ${escapeLatex(job.location)}` : escapeLatex(job.company);
    lines.push(`${I}\\begin{twocolentry}{`);
    lines.push(`${II}${escapeLatex(dateRange)}`);
    lines.push(`${I}}`);
    lines.push(`${II}\\textbf{${escapeLatex(job.title)}} | ${companyStr}`);
    lines.push(`${I}\\end{twocolentry}`);
    lines.push('');
    lines.push(`${I}\\vspace{0.10cm}`);
    lines.push(`${I}\\begin{onecolentry}`);
    lines.push(`${II}\\begin{highlights}`);
    job.bullets.forEach(bullet => { lines.push(`${III}\\item ${escapeLatex(bullet)}`); });
    lines.push(`${II}\\end{highlights}`);
    lines.push(`${I}\\end{onecolentry}`);
    if (i < resume.experience.length - 1) { lines.push(''); lines.push(`${I}\\experienceSeparator`); lines.push(''); }
  });

  lines.push('');
  lines.push(`${I}\\section{Education}`);
  lines.push('');
  resume.education.forEach((edu, i) => {
    lines.push(`${I}\\begin{twocolentry}{`);
    lines.push(`${II}${escapeLatex(edu.date)}`);
    lines.push(`${I}}`);
    lines.push(`${II}\\textbf{${escapeLatex(edu.school)}}`);
    lines.push(`${I}\\end{twocolentry}`);
    lines.push('');
    lines.push(`${I}\\vspace{0.10cm}`);
    lines.push(`${I}\\begin{onecolentry}`);
    lines.push(`${II}${escapeLatex(edu.degree)}`);
    lines.push(`${I}\\end{onecolentry}`);
    if (i < resume.education.length - 1) { lines.push(''); lines.push(`${I}\\vspace{0.20cm}`); lines.push(''); }
  });

  lines.push('');
  lines.push('\\end{document}');
  lines.push('');
  return lines.join('\n');
}

function validateBalance(latex: string): string[] {
  const beginCounts: Record<string, number> = {};
  const endCounts: Record<string, number> = {};
  for (const m of latex.matchAll(/\\begin\{(\w+)\}/g)) beginCounts[m[1]] = (beginCounts[m[1]] || 0) + 1;
  for (const m of latex.matchAll(/\\end\{(\w+)\}/g)) endCounts[m[1]] = (endCounts[m[1]] || 0) + 1;
  const errors: string[] = [];
  for (const env of new Set([...Object.keys(beginCounts), ...Object.keys(endCounts)])) {
    const b = beginCounts[env] || 0, e = endCounts[env] || 0;
    if (b !== e) errors.push(`Unbalanced: \\begin{${env}}(${b}) / \\end{${env}}(${e})`);
  }
  return errors;
}

function compilePdf(texPath: string, folderPath: string, folderName: string, jsonMode: boolean): boolean {
  const log = (...a: unknown[]) => { if (!jsonMode) console.log(...a); };
  const logErr = (...a: unknown[]) => { if (!jsonMode) console.error(...a); };

  let compiled = false;

  // Build PATH with tectonic location
  const tectonicDir = dirname(TECTONIC_PATH);
  const pathEnv = [tectonicDir, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH].join(platform() === 'win32' ? ';' : ':');

  // Try bundled/configured tectonic first
  const tectonicCmd = existsSync(TECTONIC_PATH) ? TECTONIC_PATH : 'tectonic';

  try {
    execSync(`"${tectonicCmd}" "${texPath}"`, { cwd: folderPath, stdio: 'pipe', timeout: 60000, env: { ...process.env, PATH: pathEnv } });
    compiled = true;
    log(`${TAG} Compiled with tectonic: ${folderName}.pdf`);
  } catch (e: any) {
    logErr(`${TAG} tectonic failed: ${e.stderr?.toString()?.slice(0, 200) || e.message}`);
  }

  // Fallback: system pdflatex
  if (!compiled) {
    try {
      execSync(`pdflatex -interaction=nonstopmode -halt-on-error -jobname="${folderName}" "${texPath}"`, { cwd: folderPath, stdio: 'pipe', timeout: 60000 });
      for (const ext of ['.log', '.aux', '.out']) {
        const auxPath = join(folderPath, `${folderName}${ext}`);
        if (existsSync(auxPath)) unlinkSync(auxPath);
      }
      compiled = true;
      log(`${TAG} Compiled with pdflatex: ${folderName}.pdf`);
    } catch {
      logErr(`${TAG} No PDF compiler available.`);
    }
  }

  if (compiled) {
    const pdfPath = join(folderPath, `${folderName}.pdf`);
    const altPath = join(folderPath, ALT_PDF_NAME);
    if (existsSync(pdfPath)) copyFileSync(pdfPath, altPath);
  }

  return compiled;
}
