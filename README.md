# The Seer

Tailoring a resume for every job application is slow, repetitive, and draining. Most of your time goes into reformatting and rewording — not actually applying. The Seer eliminates that bottleneck.

Visit a job posting. Click one button. The Seer scrapes the job description, scores your fit, identifies gaps, extracts ATS keywords, and generates a tailored resume PDF — all in under 2 minutes, entirely from your browser. No API keys. No cost.

You stay in control of the output. Bring your own prompt templates, pick your Claude model, toggle extended thinking, and iterate until the resume reads the way you want. The Seer handles the grunt work so you can focus on what actually matters: applying to more jobs and refining your prompts until every resume hits right.

---

## How It Works

```
You visit a job posting
        |
   Click the FAB
        |
   Seer scrapes the JD (JSON-LD > embedded data > page text > iframe fetch)
        |
   Grok analyzes fit against your profile
        |
   Score + gaps + ATS keywords shown in floating panel
        |
   Claude auto-generates a tailored resume
        |
   PDF compiled locally via LaTeX
        |
   Everything tracked in your dashboard
```

## What You Get

- **Fit Score** (0-100) with confidence rating
- **Apply Recommendation** — strong yes / yes / maybe / no
- **Key Matches** — skills and experience that align
- **Gaps** — what's missing + how to mitigate each one
- **ATS Keywords** — exact terms from the JD to include in your resume
- **Base Resume Selection** — picks the best base template for the role
- **Tailored Resume** — Claude rewrites your resume for the specific job
- **PDF Output** — compiled locally, ready to submit

---

## Architecture

```
Chrome Extension (MV3)
    |
    |--- Content Script     FAB overlay, results panel, Claude response modal
    |--- Background Worker  Orchestrates: scraping > Grok > Claude > PDF > tracking
    |--- Claude Hook        Intercepts Claude's SSE stream (MAIN world)
    |--- Popup              Model selection, score display, quick controls
    |--- Options            Profile import, prompt templates, PDF generator setup
    |
    |--- Grok (browser)     Job analysis via browser automation
    |--- Claude (browser)   Resume generation via browser automation
    |
    |--- Native Messaging   Chrome <-> local binary for PDF generation
    |       |
    |       theseer-pdf     Standalone binary (Bun-compiled)
    |           |--- Parses Claude's markdown response
    |           |--- Generates LaTeX from template
    |           |--- Compiles PDF with tectonic
    |           |--- Returns PDF path + base64 to extension
    |
    |--- Dashboard API      Vercel + MongoDB Atlas (fire-and-forget tracking)
```

### Scraping (3-tier fallback)

1. **JSON-LD** — structured `<script type="application/ld+json">` data
2. **Embedded data** — LinkedIn `<code>` blocks, `window.__INITIAL_STATE__`
3. **Page text** — cleaned HTML from `<main>` or `<body>`
4. **Iframe fetch** — Greenhouse, Lever, Workday, etc. via background permissions

Picks the **longest description** across all tiers.

### AI Pipeline

| Step | Engine | Method | Cost |
|------|--------|--------|------|
| Job analysis | Grok | Browser automation (grok.com tab) | Free |
| Resume generation | Claude | Browser automation (claude.ai tab) | Free |
| PDF compilation | Tectonic | Local binary | Free |
| Tracking | Dashboard | Vercel + MongoDB Atlas | Free |

Zero API keys required. Everything runs through browser sessions you're already logged into.

---

## Quick Start

### Prerequisites

- Google Chrome
- [Node.js](https://nodejs.org) (>= 18) and [pnpm](https://pnpm.io)
- [Grok](https://grok.com) account (free)
- [Claude](https://claude.ai) account (free)

### Install

**macOS / Linux:**

```bash
git clone https://github.com/YashD5291/TheSeer.git
cd TheSeer
./install.sh
```

**Windows** (PowerShell):

```powershell
git clone https://github.com/YashD5291/TheSeer.git
cd TheSeer
powershell -ExecutionPolicy Bypass -File install.ps1
```

The installer walks you through everything — builds the extension, downloads the PDF generator, asks where to save resumes, and registers the native messaging host. Just follow the prompts.

After setup, restart Chrome, import your profile (extension icon → Settings), and you're ready to go.

### Change output directory

```bash
~/.theseer/bin/theseer-pdf --set-output ~/Desktop/Resumes
```

### Dashboard (Optional)

The extension tracks every application to a hosted dashboard. To use your own:

1. Fork [TheSeer-Dashboard](https://github.com/YashD5291/TheSeer-Dashboard)
2. Deploy to Vercel
3. Add `MONGODB_URI` env var in Vercel (free MongoDB Atlas cluster)
4. Update `dashboardUrl` in extension storage or modify the default in `src/shared/storage.ts`

<details>
<summary><strong>Manual Setup</strong> (if you prefer step-by-step)</summary>

#### 1. Build the extension

```bash
pnpm install
cd apps/extension && node build.mjs
```

#### 2. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `apps/extension/`
4. Copy your **Extension ID**

#### 3. Install the PDF generator

Download from the [Releases page](https://github.com/YashD5291/TheSeer/releases) or build from source:

```bash
cd apps/resume-gen && bun run build.ts
```

Run setup (output directory is required):

```bash
./theseer-pdf --setup YOUR_EXTENSION_ID --output-dir ~/Resumes
```

#### 4. Import your profile

Click the extension icon → **Settings** → drag your `seer-profile-export.json` into the import area.

The profile JSON structure:

```json
{
  "profile": {
    "skills_expert": ["Python", "PyTorch", "LLMs"],
    "skills_proficient": ["Docker", "Kubernetes"],
    "skills_familiar": ["Rust", "Go"],
    "experience_years": 5,
    "titles_held": ["ML Engineer", "Software Engineer"],
    "target_titles": ["Senior ML Engineer", "AI Engineer"],
    "target_industries": [],
    "deal_breakers": ["No remote"],
    "location_preferences": {}
  },
  "baseResumeSummaries": {
    "gen_ai": "GenAI focused: LLMs, RAG, transformers...",
    "mle": "ML Engineering focused: pipelines, MLOps...",
    "mix": "Generalist: combines GenAI + MLE strengths..."
  },
  "prompts": {
    "gen_ai": "Your Claude prompt template for GenAI roles...",
    "mle": "Your Claude prompt template for MLE roles...",
    "mix": "Your Claude prompt template for generalist roles..."
  }
}
```

#### 5. Restart Chrome and try it

Visit any job posting → click the **S** button (bottom right).

</details>

---

## Controls

### Popup

| Control | Options | What it does |
|---------|---------|-------------|
| **Enable/Disable** | Toggle | Turns Seer on/off globally |
| **Grok Model** | Fast / Expert / Auto | Selects Grok model for analysis |
| **Claude Model** | Sonnet 4.5, 4.6 / Haiku / Opus | Selects Claude model for resume gen |
| **Extended Thinking** | On / Off | Enables Claude's extended thinking |
| **Seer Context** | On / Off | Appends fit analysis to Claude prompt |

### Keyboard / Mouse

| Action | Result |
|--------|--------|
| Click FAB | Analyze current page |
| Click FAB again | Toggle results panel |
| Drag FAB | Reposition on screen |
| Click score in panel | View full analysis |
| Copy JD | Copies job description to clipboard |
| Copy Resume | Copies Claude's resume response |
| View PDF | Opens generated PDF |

---

## Project Structure

```
TheSeer/
  apps/
    extension/              Chrome MV3 extension
      src/
        background/         Service worker (pipeline orchestration)
        content/            FAB, results panel, Claude modal
        claude-hook/        SSE stream interceptor (MAIN world)
        popup/              Extension popup UI
        options/            Settings page
        scrapers/           3-tier job extraction
        shared/             Types, storage, tracker, prompt builder
      manifest.json
      build.mjs             esbuild config (~6ms builds)
    resume-gen/             PDF generation pipeline
      main.ts               Unified binary (CLI + native host + setup)
      build.ts              Cross-platform compilation
      GEN/GEN-V3.tex        LaTeX resume template
  packages/
    core/                   Shared business logic
    cli/                    Command-line interface
    db/                     Database layer
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build extension (one-time)
cd apps/extension && node build.mjs

# Watch mode (auto-rebuild on changes)
cd apps/extension && node build.mjs --watch

# Build PDF generator binary
cd apps/resume-gen && bun run build.ts

# Build for all platforms
cd apps/resume-gen && bun run build.ts --all
```

After rebuilding, click the refresh icon on `chrome://extensions` to reload.

---

## Console Debugging

All logs are prefixed for easy filtering in Chrome DevTools:

| Tag | Source |
|-----|--------|
| `[Seer]` | Content script |
| `[Seer BG]` | Background worker |
| `[Seer Scraper]` | Page extraction |
| `[Seer Grok]` | Grok automation |
| `[Seer Claude]` | Claude automation |
| `[Seer Hook]` | Claude response capture |
| `[Seer Tracker]` | Dashboard tracking |

Filter in DevTools Console: type `[Seer` to see all extension logs.

---

## Release Pipeline

Tag a version to trigger cross-platform builds via GitHub Actions:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This builds standalone binaries for macOS (ARM + Intel) and Windows (x64), bundles tectonic, and publishes to GitHub Releases.

---

Built with Grok, Claude, Chrome MV3, Bun, Tectonic, Next.js, MongoDB Atlas, and Vercel.
