import fs from 'fs';
import path from 'path';
import { parseProfile } from '@the-seer/core/profile-parser';
import { quickFitCheck } from '@the-seer/core/quick-fit';
import { deepFitAnalysis } from '@the-seer/core/fit-analyzer';
import { buildClaudePrompt } from '@the-seer/core/prompt-builder';
import { CONFIG, getDataPath } from '@the-seer/core/config';
import type { JobData, FitAnalysis, BaseResumeSlug } from '@the-seer/core/types';

// ─── Load data files ────────────────────────────────────────────────

function loadFile(relativePath: string): string {
  const fullPath = getDataPath(relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

const careerStory = loadFile(CONFIG.files.careerStory);
const resumes = {
  gen_ai: loadFile(CONFIG.files.resumes.gen_ai),
  mle: loadFile(CONFIG.files.resumes.mle),
  mix: loadFile(CONFIG.files.resumes.mix),
};
const prompts = {
  gen_ai: loadFile(CONFIG.files.prompts.gen_ai),
  mle: loadFile(CONFIG.files.prompts.mle),
  mix: loadFile(CONFIG.files.prompts.mix),
};

// ─── Parse a JD file into JobData ───────────────────────────────────

function parseJDFile(filePath: string): JobData {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`JD file not found: ${resolvedPath}`);
    process.exit(1);
  }
  const text = fs.readFileSync(resolvedPath, 'utf-8');

  // Try to extract title and company from the first lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let title = 'Role';
  let company = 'Company';
  let location: string | undefined;
  let salary_range: string | undefined;
  let descriptionStart = 0;

  // Heuristic: first line is often the title, second might be company
  if (lines.length > 0) {
    title = lines[0].replace(/^#+\s*/, '');
    descriptionStart = 1;
  }
  if (lines.length > 1 && lines[1].length < 100) {
    company = lines[1];
    descriptionStart = 2;
  }
  // Check for location line
  if (lines.length > 2 && /remote|hybrid|on.?site|,\s*[A-Z]{2}\b/i.test(lines[2])) {
    location = lines[2];
    descriptionStart = 3;
  }
  // Check for salary
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (/\$\d/.test(lines[i])) {
      salary_range = lines[i];
    }
  }

  return {
    title,
    company,
    url: undefined,
    location,
    salary_range,
    job_type: undefined,
    description: lines.slice(descriptionStart).join('\n'),
    requirements: [],
    nice_to_haves: [],
  };
}

// ─── CLI Commands ───────────────────────────────────────────────────

const command = process.argv[2];
const args = process.argv.slice(3);
const jdPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

async function main() {
  // Parse profile from files
  const profile = parseProfile(careerStory, resumes);

  switch (command) {
    case 'profile': {
      console.log('\n=== THE SEER — Auto-Parsed Profile ===\n');
      console.log(`Expert (${profile.skills_expert.length}):`, profile.skills_expert.join(', '));
      console.log(`Proficient (${profile.skills_proficient.length}):`, profile.skills_proficient.join(', '));
      console.log(`Familiar (${profile.skills_familiar.length}):`, profile.skills_familiar.join(', '));
      console.log(`\nExperience: ${profile.experience_years} years`);
      console.log(`Titles held: ${profile.titles_held.join(', ') || 'None extracted'}`);
      console.log(`Target titles: ${profile.target_titles.join(', ') || 'None extracted'}`);
      console.log(`Industries: ${profile.target_industries.join(', ') || 'None extracted'}`);
      console.log(`Deal-breakers: ${profile.deal_breakers.join(', ') || 'None extracted'}`);
      console.log(`Location: ${JSON.stringify(profile.location_preferences)}`);
      break;
    }

    case 'quick-fit': {
      if (!jdPath) {
        console.log('Usage: pnpm seer quick-fit ./jd.txt');
        return;
      }
      const job = parseJDFile(jdPath);
      const quick = quickFitCheck(job, profile);

      console.log('\n=== THE SEER — Quick Fit (local, no API) ===\n');
      console.log(`Job: ${job.title} @ ${job.company}`);
      if (job.location) console.log(`Location: ${job.location}`);
      if (job.salary_range) console.log(`Salary: ${job.salary_range}`);
      console.log('');
      console.log(`Score: ${quick.score}/100`);
      console.log(`Pass: ${quick.pass ? 'YES ✓' : 'NO ✗'}`);
      if (quick.deal_breaker_hit) {
        console.log(`Deal-breaker hit: ${quick.deal_breaker_hit}`);
      }
      console.log(`\nMatched skills (${quick.matched.length}): ${quick.matched.join(', ')}`);
      if (quick.missing.length > 0) {
        console.log(`Not in JD (${quick.missing.length}): ${quick.missing.join(', ')}`);
      }
      break;
    }

    case 'analyze': {
      if (!jdPath) {
        console.log('Usage: pnpm seer analyze ./jd.txt');
        return;
      }
      const job = parseJDFile(jdPath);

      console.log('\n=== THE SEER — Deep Fit Analysis (Gemini) ===\n');
      console.log(`Analyzing: ${job.title} @ ${job.company}`);
      console.log('Calling Gemini...\n');

      const analysis = await deepFitAnalysis(job, profile, CONFIG.baseResumeSummaries);

      console.log(`Fit Score: ${analysis.fit_score}/100 (Confidence: ${analysis.confidence}%)`);
      console.log(`Recommended Base: ${analysis.recommended_base}`);
      console.log(`Reasoning: ${analysis.base_reasoning}`);
      console.log(`Apply: ${analysis.apply_recommendation}`);
      console.log(`Competition: ${analysis.estimated_competition}`);
      console.log(`\nKey Matches: ${analysis.key_matches.join(', ')}`);
      console.log(`Gaps: ${analysis.gaps.join(', ')}`);
      console.log(`Gap Mitigation: ${analysis.gap_mitigation.join('; ')}`);
      console.log(`ATS Keywords: ${analysis.ats_keywords.join(', ')}`);
      console.log(`Tailoring Priorities: ${analysis.tailoring_priorities.join('; ')}`);
      if (analysis.red_flags.length > 0) {
        console.log(`Red Flags: ${analysis.red_flags.join(', ')}`);
      }
      break;
    }

    case 'prompt': {
      if (!jdPath) {
        console.log('Usage: pnpm seer prompt ./jd.txt [--dry-run]');
        return;
      }
      const job = parseJDFile(jdPath);

      let analysis: FitAnalysis;

      if (dryRun) {
        console.log('\n=== THE SEER — Prompt Generation (DRY RUN) ===\n');
        console.log(`Job: ${job.title} @ ${job.company}`);

        // Quick fit to pick a reasonable base
        const quick = quickFitCheck(job, profile);
        console.log(`Quick fit: ${quick.score}/100`);

        // Mock analysis using quick-fit data
        analysis = {
          fit_score: quick.score,
          confidence: 70,
          recommended_base: 'gen_ai', // default for dry run
          base_reasoning: 'Dry run - defaulting to gen_ai base',
          key_matches: quick.matched,
          gaps: [],
          gap_mitigation: [],
          tailoring_priorities: ['Emphasize matched skills from quick-fit'],
          ats_keywords: quick.matched.slice(0, 10),
          red_flags: [],
          estimated_competition: 'medium',
          apply_recommendation: quick.pass ? 'yes' : 'maybe',
        };
      } else {
        // Step 1: Run Gemini analysis
        console.log('\n=== THE SEER — Full Prompt Generation ===\n');
        console.log(`Job: ${job.title} @ ${job.company}`);
        console.log('Running Gemini analysis...');

        analysis = await deepFitAnalysis(job, profile, CONFIG.baseResumeSummaries);
      }

      console.log(`\nBase selected: ${analysis.recommended_base} (score: ${analysis.fit_score}/100)`);
      console.log(`Apply recommendation: ${analysis.apply_recommendation}`);

      // Step 2: Build Claude.ai prompt
      const selectedBase = analysis.recommended_base;
      const claudePrompt = buildClaudePrompt({
        job,
        analysis,
        promptTemplate: prompts[selectedBase],
        selectedBase,
      });

      // Step 3: Save to file
      const outDir = getDataPath('output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const timestamp = new Date().toISOString().slice(0, 10);
      const slug = `${job.company.toLowerCase().replace(/\s+/g, '-')}_${job.title.toLowerCase().replace(/\s+/g, '-')}`;
      const outPath = path.join(outDir, `${timestamp}_${slug}.txt`);
      fs.writeFileSync(outPath, claudePrompt);

      // Also save analysis
      const analysisPath = path.join(outDir, `${timestamp}_${slug}_analysis.json`);
      fs.writeFileSync(analysisPath, JSON.stringify({ job, analysis }, null, 2));

      console.log(`\nClaude.ai prompt saved to: ${outPath}`);
      console.log(`Analysis saved to: ${analysisPath}`);
      console.log(`Prompt length: ${claudePrompt.length} chars`);
      console.log('\n→ Paste this into claude.ai (your RMS project) to test output quality.');
      break;
    }

    case 'full': {
      if (!jdPath) {
        console.log('Usage: pnpm seer full ./jd.txt');
        return;
      }
      const job = parseJDFile(jdPath);

      console.log('\n=== THE SEER — Full Pipeline ===\n');
      console.log(`Job: ${job.title} @ ${job.company}\n`);

      // Step 1: Quick fit
      console.log('Step 1: Quick fit check...');
      const quick = quickFitCheck(job, profile);
      console.log(`  Local score: ${quick.score}/100 (${quick.pass ? 'PASS' : 'FAIL'})`);
      console.log(`  Matched: ${quick.matched.join(', ')}\n`);

      if (!quick.pass) {
        console.log('Quick fit failed. Job may not be a good match.');
        console.log('Run with --force to continue anyway, or use "pnpm seer analyze" for deeper analysis.\n');
        if (!process.argv.includes('--force')) return;
        console.log('--force flag detected, continuing...\n');
      }

      // Step 2: Deep analysis
      console.log('Step 2: Gemini deep analysis...');
      const analysis = await deepFitAnalysis(job, profile, CONFIG.baseResumeSummaries);
      console.log(`  Fit score: ${analysis.fit_score}/100`);
      console.log(`  Base: ${analysis.recommended_base}`);
      console.log(`  Verdict: ${analysis.apply_recommendation}\n`);

      // Step 3: Build prompt
      console.log('Step 3: Building Claude.ai prompt...');
      const selectedBase = analysis.recommended_base;
      const claudePrompt = buildClaudePrompt({
        job,
        analysis,
        promptTemplate: prompts[selectedBase],
        selectedBase,
      });

      // Step 4: Save everything
      const outDir = getDataPath('output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const timestamp = new Date().toISOString().slice(0, 10);
      const slug = `${job.company.toLowerCase().replace(/\s+/g, '-')}_${job.title.toLowerCase().replace(/\s+/g, '-')}`;

      const promptPath = path.join(outDir, `${timestamp}_${slug}.txt`);
      fs.writeFileSync(promptPath, claudePrompt);

      const analysisPath = path.join(outDir, `${timestamp}_${slug}_analysis.json`);
      fs.writeFileSync(analysisPath, JSON.stringify({
        job,
        quick_fit: quick,
        analysis,
        base_used: selectedBase,
        generated_at: new Date().toISOString(),
      }, null, 2));

      console.log(`Prompt saved: ${promptPath}`);
      console.log(`Analysis saved: ${analysisPath}`);
      console.log(`\n→ Paste the prompt into claude.ai to generate your tailored resume.`);
      break;
    }

    case 'export': {
      const outDir = getDataPath('output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const exportData = {
        profile,
        baseResumeSummaries: CONFIG.baseResumeSummaries,
        prompts: {
          gen_ai: prompts.gen_ai,
          mle: prompts.mle,
          mix: prompts.mix,
        },
        exported_at: new Date().toISOString(),
      };

      const outPath = path.join(outDir, 'seer-profile-export.json');
      fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2));

      console.log('\n=== THE SEER — Profile Export ===\n');
      console.log(`Profile exported to: ${outPath}`);
      console.log(`Expert skills: ${profile.skills_expert.length}`);
      console.log(`Proficient skills: ${profile.skills_proficient.length}`);
      console.log(`Familiar skills: ${profile.skills_familiar.length}`);
      console.log(`Prompt templates: 3 (gen_ai, mle, mix)`);
      console.log('\n-> Import this file into The Seer Chrome extension via Options page.');
      break;
    }

    default: {
      console.log(`
THE SEER — AI-Powered Resume Tailoring Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  pnpm seer profile              View auto-parsed profile from your files
  pnpm seer quick-fit ./jd.txt   Local fit check (instant, no API)
  pnpm seer analyze ./jd.txt     Deep fit analysis via Gemini
  pnpm seer prompt ./jd.txt      Generate Claude.ai prompt (analyze + build)
  pnpm seer full ./jd.txt        Full pipeline (quick-fit + analyze + prompt)
  pnpm seer export               Export profile for Chrome extension
`);
    }
  }
}

main().catch((err) => {
  console.error('\nError:', err.message || err);
  process.exit(1);
});
