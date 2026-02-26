#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ================================
// Constants
// ================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(SCRIPT_DIR, 'GEN', 'GEN-V3.tex');
const OUTPUT_BASE = join(SCRIPT_DIR, 'Experimental');
const ALT_PDF_NAME = 'Juan_Flores_Machine_Learning_Engineer_Nov_2025.pdf';
const TAG = '[resgen]';

// ================================
// JSON mode (module-level)
// ================================

let jsonMode = false;
const log = (...args) => { if (!jsonMode) console.log(...args); };
const logErr = (...args) => { if (!jsonMode) console.error(...args); };
const logWarn = (...args) => { if (!jsonMode) console.warn(...args); };

// ================================
// Phase 1: Read Input
// ================================

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = null;
  let nameOverride = null;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      json = true;
    } else if (args[i] === '--name' && args[i + 1]) {
      nameOverride = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage();
      process.exit(0);
    } else if (!filePath && !args[i].startsWith('--')) {
      filePath = args[i];
    }
  }

  return { filePath, nameOverride, json };
}

function printUsage() {
  console.log(`
Usage:
  resgen <input.md>                        # From file
  resgen <input.md> --name "Folder Name"   # From file with custom folder name
  pbpaste | resgen --name "Folder Name"    # From clipboard
  resgen <input.md> --json                 # Machine-readable JSON output

Options:
  --name <name>   Override folder name (otherwise derived from chat title)
  --json          Output JSON to stdout (for native messaging)
  --help, -h      Show this help
`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function getInput(filePath) {
  if (filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return readFileSync(filePath, 'utf-8');
  }

  if (!process.stdin.isTTY) {
    return await readStdin();
  }

  if (!jsonMode) {
    printUsage();
    process.exit(1);
  }
  throw new Error('No input provided');
}

// ================================
// Phase 2: Parse Markdown
// ================================

function extractChatTitle(input) {
  const match = input.match(/^#\s*CHAT TITLE\s*\n\*\*(.+?)\*\*/m);
  if (!match) return null;
  return match[1]
    .replace(/\s*[-–—]\s*Resume Analysis\s*$/i, '')
    .replace(/\s*Resume Analysis\s*$/i, '')
    .trim();
}

function extractResumeSection(input) {
  const match = input.match(/## TAILORED RESUME\s*\n([\s\S]*?)(?=\n## CHANGELOG|\n---(?:\s*\n|$))/);
  if (match) return match[1].trim();

  // Fallback: if no TAILORED RESUME header, check if input starts with resume content directly
  const hasResumeMarkers = /^# .+\n/.test(input.trim()) && /## Experience/.test(input);
  if (hasResumeMarkers) return input.trim();

  throw new Error('Could not find "## TAILORED RESUME" section in input.');
}

function parseResume(text) {
  const resume = {
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
  };

  // Name: first # heading
  const nameMatch = text.match(/^# (.+)$/m);
  if (!nameMatch) {
    throw new Error('Could not parse name from resume (expected "# Name").');
  }
  resume.name = nameMatch[1].trim();

  // Contact fields
  const emailMatch = text.match(/\*\*Email:\*\*\s*(.+)/);
  const phoneMatch = text.match(/\*\*Phone:\*\*\s*(.+)/);
  const linkedinMatch = text.match(/\*\*LinkedIn:\*\*\s*(.+)/);
  const githubMatch = text.match(/\*\*GitHub:\*\*\s*(.+)/);

  resume.email = emailMatch ? emailMatch[1].trim().replace(/\s{2,}$/, '') : '';
  resume.phone = phoneMatch ? phoneMatch[1].trim().replace(/\s{2,}$/, '') : '';
  resume.linkedin = linkedinMatch ? linkedinMatch[1].trim().replace(/\s{2,}$/, '') : '';
  resume.github = githubMatch ? githubMatch[1].trim().replace(/\s{2,}$/, '') : '';

  // Summary: text between last contact field and ## Skills
  const summaryMatch = text.match(/\*\*GitHub:\*\*[^\n]*\n\n([\s\S]*?)(?=\n## Skills)/);
  if (summaryMatch) {
    resume.summary = summaryMatch[1].trim();
  } else {
    // Fallback: try after all contact fields
    const altMatch = text.match(/\*\*(?:Email|Phone|LinkedIn|GitHub):\*\*[^\n]*\n(?:\*\*(?:Email|Phone|LinkedIn|GitHub):\*\*[^\n]*\n)*\n([\s\S]*?)(?=\n## Skills)/);
    if (altMatch) resume.summary = altMatch[1].trim();
  }

  // Skills: between ## Skills and ## Experience
  const skillsBlock = text.match(/## Skills\s*\n([\s\S]*?)(?=\n## Experience)/);
  if (skillsBlock) {
    const skillLines = skillsBlock[1].trim().split('\n').filter(l => l.trim());
    resume.skills = skillLines
      .map(line => {
        const m = line.match(/\*\*(.+?):\*\*\s*(.+)/);
        if (!m) return null;
        return { category: m[1].trim(), items: m[2].trim() };
      })
      .filter(Boolean);
  }

  // Experience: between ## Experience and ## Education
  const expBlock = text.match(/## Experience\s*\n([\s\S]*?)(?=\n## Education)/);
  if (!expBlock) {
    throw new Error('Could not find Experience section.');
  }

  const expText = expBlock[1].trim();
  // Split on job header: **Title** | Company
  const jobChunks = expText.split(/(?=^\*\*[^*]+\*\*\s*\|)/m).filter(c => c.trim());

  resume.experience = jobChunks.map(chunk => {
    const lines = chunk.trim().split('\n');

    // Line 1: **Title** | Company -- Location
    const headerMatch = lines[0].match(/\*\*(.+?)\*\*\s*\|\s*(.+)/);
    if (!headerMatch) {
      logWarn(`${TAG} Warning: Could not parse job header: ${lines[0]}`);
      return null;
    }

    const titlePart = headerMatch[1].trim();
    const companyPart = headerMatch[2].trim().replace(/\s{2,}$/, '');

    // Parse company and location from "Company -- Location" or "Company, Location"
    let company = companyPart;
    let location = '';
    const compLocMatch = companyPart.match(/^(.+?)\s*--\s*(.+)$/);
    if (compLocMatch) {
      company = compLocMatch[1].trim();
      location = compLocMatch[2].trim();
    }

    // Line 2: Date range (may have en/em dash)
    const dateLine = (lines[1] || '').trim();

    // Remaining lines: bullets starting with "- "
    const bullets = lines.slice(2)
      .filter(l => l.trim().startsWith('- '))
      .map(l => l.replace(/^-\s*/, '').trim());

    return { title: titlePart, company, location, dateRange: dateLine, bullets };
  }).filter(Boolean);

  // Education: after ## Education
  const eduBlock = text.match(/## Education\s*\n([\s\S]*?)$/);
  if (eduBlock) {
    const eduText = eduBlock[1].trim();
    // Split on **School Name** pattern
    const eduChunks = eduText.split(/(?=^\*\*)/m).filter(c => c.trim());

    resume.education = eduChunks.map(chunk => {
      const lines = chunk.trim().split('\n').filter(l => l.trim());
      const schoolMatch = lines[0].match(/\*\*(.+?)\*\*/);
      if (!schoolMatch) return null;
      return {
        school: schoolMatch[1].trim(),
        date: (lines[1] || '').trim(),
        degree: (lines[2] || '').trim(),
      };
    }).filter(Boolean);
  }

  return resume;
}

// ================================
// Phase 3: Ceaser Rules
// ================================

function applyCeaserRules(resume) {
  // Rule 1: Labelbox date fix (Jul 2025 -> Oct 2025)
  resume.experience.forEach(job => {
    if (/labelbox/i.test(job.company)) {
      job.dateRange = job.dateRange.replace(/Jul[\s-]*2025/gi, 'Oct 2025');
    }
  });

  // Rule 2: LinkedIn removal is implicit (we simply don't output it)
}

// ================================
// Phase 4: Generate LaTeX
// ================================

function escapeLatex(text) {
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

function readPreamble() {
  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  }
  const templateLines = readFileSync(TEMPLATE_PATH, 'utf-8').split('\n');
  // Preamble = everything through \sbox\ANDbox{$|$}
  const endIdx = templateLines.findIndex(l => l.includes('\\sbox\\ANDbox'));
  if (endIdx === -1) throw new Error('Cannot find preamble end marker (\\sbox\\ANDbox) in template');
  return templateLines.slice(0, endIdx + 1).join('\n');
}

function generateContent(resume) {
  const I = '    '; // 4-space indent
  const II = '        '; // 8-space indent
  const III = '            '; // 12-space indent
  const lines = [];

  // === HEADER ===
  lines.push(`${I}% ================================`);
  lines.push(`${I}% HEADER SECTION`);
  lines.push(`${I}% ================================`);
  lines.push(`${I}\\begin{header}`);
  lines.push(`${II}\\fontsize{22pt}{22pt}\\selectfont`);
  lines.push(`${II}\\textbf{${escapeLatex(resume.name)}}`);
  lines.push('');
  lines.push(`${II}\\vspace{6pt}`);
  lines.push('');
  lines.push(`${II}\\normalsize`);

  // Contact: email {|} phone {|} github — no LinkedIn
  const email = resume.email;
  const phone = resume.phone;
  const github = resume.github;
  const phoneTel = phone.replace(/[() ]/g, m => m === '(' || m === ')' ? '' : '-');
  const githubUrl = github.startsWith('http') ? github : `https://${github}`;

  lines.push(`${II}{\\hrefWithoutArrow{mailto:${email}}{${email}}}`);
  lines.push(`${II}{|}`);
  lines.push(`${II}{\\hrefWithoutArrow{tel:${phoneTel}}{${escapeLatex(phone)}}}`);
  lines.push(`${II}{|}`);
  lines.push(`${II}{\\hrefWithoutArrow{${githubUrl}}{${github}}}`);
  lines.push(`${I}\\end{header}`);

  // === SUMMARY ===
  lines.push('');
  lines.push(`${I}\\vspace{0.3cm}`);
  lines.push('');
  lines.push(`${I}\\begin{onecolentry}`);
  lines.push(`${II}${escapeLatex(resume.summary)}`);
  lines.push(`${I}\\end{onecolentry}`);

  // === SKILLS ===
  lines.push('');
  lines.push(`${I}% ================================`);
  lines.push(`${I}% SKILLS`);
  lines.push(`${I}% ================================`);
  lines.push(`${I}\\section{Skills}`);
  lines.push('');

  resume.skills.forEach((skill, i) => {
    lines.push(`${I}\\begin{onecolentry}`);
    lines.push(`${II}\\textbf{${escapeLatex(skill.category)}:} ${escapeLatex(skill.items)}`);
    lines.push(`${I}\\end{onecolentry}`);
    if (i < resume.skills.length - 1) {
      lines.push('');
      lines.push(`${I}\\vspace{0.15cm}`);
      lines.push('');
    }
  });

  // === EXPERIENCE ===
  lines.push('');
  lines.push(`${I}% ================================`);
  lines.push(`${I}% EXPERIENCE`);
  lines.push(`${I}% ================================`);
  lines.push(`${I}\\section{Experience}`);
  lines.push('');

  resume.experience.forEach((job, i) => {
    // Normalize date range dashes
    const dateRange = job.dateRange.replace(/[–—]/g, '--');

    const companyStr = job.location
      ? `${escapeLatex(job.company)} -- ${escapeLatex(job.location)}`
      : escapeLatex(job.company);

    // Company comment matching template format
    lines.push(`${I}% Company ${i + 1}: ${job.company}`);
    lines.push(`${I}\\begin{twocolentry}{`);
    lines.push(`${II}${escapeLatex(dateRange)}`);
    lines.push(`${I}}`);
    lines.push(`${II}\\textbf{${escapeLatex(job.title)}} | ${companyStr}`);
    lines.push(`${I}\\end{twocolentry}`);
    lines.push('');
    lines.push(`${I}\\vspace{0.10cm}`);
    lines.push(`${I}\\begin{onecolentry}`);
    lines.push(`${II}\\begin{highlights}`);

    job.bullets.forEach(bullet => {
      lines.push(`${III}\\item ${escapeLatex(bullet)}`);
    });

    lines.push(`${II}\\end{highlights}`);
    lines.push(`${I}\\end{onecolentry}`);

    if (i < resume.experience.length - 1) {
      lines.push('');
      lines.push(`${I}\\experienceSeparator`);
      lines.push('');
    }
  });

  // === EDUCATION ===
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

    if (i < resume.education.length - 1) {
      lines.push('');
      lines.push(`${I}\\vspace{0.20cm}`);
      lines.push('');
    }
  });

  lines.push('');
  lines.push('\\end{document}');
  lines.push(''); // trailing newline

  return lines.join('\n');
}

function validateBalance(latex) {
  const beginMatches = [...latex.matchAll(/\\begin\{(\w+)\}/g)];
  const endMatches = [...latex.matchAll(/\\end\{(\w+)\}/g)];

  const beginCounts = {};
  const endCounts = {};

  beginMatches.forEach(m => { beginCounts[m[1]] = (beginCounts[m[1]] || 0) + 1; });
  endMatches.forEach(m => { endCounts[m[1]] = (endCounts[m[1]] || 0) + 1; });

  const allEnvs = new Set([...Object.keys(beginCounts), ...Object.keys(endCounts)]);
  const errors = [];
  for (const env of allEnvs) {
    const b = beginCounts[env] || 0;
    const e = endCounts[env] || 0;
    if (b !== e) {
      errors.push(`Unbalanced: \\begin{${env}}(${b}) / \\end{${env}}(${e})`);
    }
  }
  return errors;
}

// ================================
// Phase 5 & 6: Write Files & Compile
// ================================

function ensureTectonic() {
  try {
    execSync('which tectonic', { stdio: 'pipe' });
    return true;
  } catch {
    log(`${TAG} tectonic not found. Installing via brew...`);
    try {
      execSync('brew install tectonic', { stdio: jsonMode ? 'pipe' : 'inherit', timeout: 300000 });
      return true;
    } catch (e) {
      logWarn(`${TAG} Failed to install tectonic via brew.`);
      return false;
    }
  }
}

function compilePdf(texPath, folderPath, folderName) {
  const pdfName = `${folderName}.pdf`;
  let compiled = false;

  // Try tectonic
  if (ensureTectonic()) {
    try {
      execSync(`tectonic "${texPath}"`, { cwd: folderPath, stdio: 'pipe', timeout: 60000 });
      compiled = true;
      log(`${TAG} Compiled with tectonic: ${pdfName}`);
    } catch (e) {
      logErr(`${TAG} tectonic compilation failed:`);
      logErr(e.stderr?.toString() || e.message);
    }
  }

  // Fallback: pdflatex
  if (!compiled) {
    try {
      execSync('which pdflatex', { stdio: 'pipe' });
      execSync(
        `pdflatex -interaction=nonstopmode -halt-on-error -jobname="${folderName}" "${texPath}"`,
        { cwd: folderPath, stdio: 'pipe', timeout: 60000 }
      );
      // Cleanup aux files
      for (const ext of ['.log', '.aux', '.out']) {
        const auxPath = join(folderPath, `${folderName}${ext}`);
        if (existsSync(auxPath)) unlinkSync(auxPath);
      }
      compiled = true;
      log(`${TAG} Compiled with pdflatex: ${pdfName}`);
    } catch {
      logErr(`${TAG} No PDF compiler available. .tex file saved at:`);
      logErr(`  ${texPath}`);
      logErr(`${TAG} Install tectonic: brew install tectonic`);
      return false;
    }
  }

  // Copy to alt name
  if (compiled) {
    const pdfPath = join(folderPath, pdfName);
    const altPath = join(folderPath, ALT_PDF_NAME);
    if (existsSync(pdfPath)) {
      copyFileSync(pdfPath, altPath);
      log(`${TAG} Copied to: ${ALT_PDF_NAME}`);
    }
  }

  return compiled;
}

// ================================
// Main
// ================================

async function main() {
  const { filePath, nameOverride, json } = parseArgs();
  jsonMode = json;

  const input = await getInput(filePath);

  // Derive folder name
  let folderName = nameOverride || extractChatTitle(input);
  if (!folderName) {
    if (!jsonMode && (!process.stdin.isTTY || !filePath)) {
      logErr(`${TAG} No chat title found and no --name provided.`);
      logErr(`${TAG} Usage: resgen input.md --name "Company - Role"`);
      process.exit(1);
    }
    if (filePath) {
      const base = filePath.replace(/\.[^.]+$/, '').replace(/.*\//, '');
      folderName = base;
      logWarn(`${TAG} No chat title found. Using filename: "${folderName}"`);
    } else {
      throw new Error('No chat title found and no --name provided.');
    }
  }

  log(`${TAG} Folder: ${folderName}`);

  // Parse resume
  const resumeText = extractResumeSection(input);
  const resume = parseResume(resumeText);

  log(`${TAG} Parsed: ${resume.name}`);
  log(`${TAG}   Skills: ${resume.skills.length} categories`);
  log(`${TAG}   Experience: ${resume.experience.length} positions`);
  log(`${TAG}   Education: ${resume.education.length} entries`);

  // Apply ceaser rules
  applyCeaserRules(resume);

  // Generate LaTeX
  const preamble = readPreamble();
  const content = generateContent(resume);
  const latex = preamble + '\n' + content;

  // Validate balance
  const balanceErrors = validateBalance(latex);
  if (balanceErrors.length > 0) {
    logWarn(`${TAG} LaTeX balance warnings:`);
    balanceErrors.forEach(e => logWarn(`  ${e}`));
  }

  // Write files
  const folderPath = join(OUTPUT_BASE, folderName);
  mkdirSync(folderPath, { recursive: true });

  const texFileName = `${folderName}.tex`;
  const texPath = join(folderPath, texFileName);
  writeFileSync(texPath, latex, 'utf-8');
  log(`${TAG} Wrote: ${texPath}`);

  // Compile
  const compiled = compilePdf(texPath, folderPath, folderName);

  const pdfPath = compiled ? join(folderPath, `${folderName}.pdf`) : null;
  const altPdfPath = compiled ? join(folderPath, ALT_PDF_NAME) : null;

  // JSON output
  if (jsonMode) {
    process.stdout.write(JSON.stringify({
      success: compiled,
      folderName,
      folderPath,
      texPath,
      pdfPath,
      altPdfPath,
    }) + '\n');
    return;
  }

  // Human-readable summary
  log('');
  if (compiled) {
    log(`${TAG} Done! Files at:`);
    log(`  ${texPath}`);
    log(`  ${pdfPath}`);
    log(`  ${altPdfPath}`);
  } else {
    log(`${TAG} .tex created (PDF compilation skipped).`);
    log(`  ${texPath}`);
  }
}

main().catch(err => {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
    process.exit(1);
  }
  console.error(`${TAG} Fatal error:`, err.message);
  process.exit(1);
});
