import { getSettings, saveJobForTab, getJobForTab, removeJobForTab, getEnabled } from '../shared/storage.js';
import { extractAndAnalyzeViaGrok } from '../shared/grok-client.js';
import { buildClaudePrompt } from '../shared/prompt-builder.js';
import type { ScrapedJob, MessageType } from '../shared/types.js';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  // Grok automation results are handled by the one-time listener in callGrok — skip here
  if ((message as any).type === 'SEER_GROK_RESULT') return;
  // Toggle messages are handled by content script directly
  if ((message as any).type === 'SEER_TOGGLE') return;

  const tabId = sender.tab?.id;
  handleMessage(message, tabId).then(sendResponse).catch(err => {
    sendResponse({ type: 'ERROR', message: err.message || 'Unknown error' });
  });
  return true; // keep channel open for async response
});

// Clean up stored job data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  removeJobForTab(tabId).catch(() => {});
});

async function handleMessage(message: MessageType, senderTabId?: number): Promise<any> {
  console.log(`[Seer BG] Received message: ${message.type} (tab: ${senderTabId ?? 'unknown'})`);
  const settings = await getSettings();

  switch (message.type) {
    // ─── New: Content script sends extraction result ──────────────
    case 'PAGE_EXTRACTED': {
      const enabled = await getEnabled();
      if (!enabled) {
        return { type: 'ERROR', message: 'Seer is disabled.' };
      }

      const { extraction } = message;
      console.log(`[Seer BG] Extraction method: ${extraction.extractionMethod}, hasJobData: ${!!extraction.jobData}, rawText: ${extraction.rawText.length} chars`);

      if (!settings.profile) {
        console.log('[Seer BG] ERROR: No profile configured');
        return { type: 'ERROR', message: 'Profile not configured. Go to extension Options to import your profile.' };
      }
      console.log(`[Seer BG] Profile loaded (${settings.profile.skills_expert.length} expert skills)`);

      // ── Gather best content, send to Grok for full analysis ──
      console.log(`[Seer BG] Gathering content for Grok analysis`);
      let rawText = extraction.rawText;

      // Try Crawl4AI first
      let crawlMarkdown = await tryCrawlServer(extraction.url, extraction.iframeUrls);
      if (crawlMarkdown) {
        crawlMarkdown = cleanCrawlMarkdown(crawlMarkdown);
        console.log(`[Seer BG] Crawl4AI returned ${crawlMarkdown.length} chars (cleaned)`);
        if (crawlMarkdown.length > rawText.length) rawText = crawlMarkdown;
      }

      // Fallback: direct iframe fetch if Crawl4AI unavailable
      if (!crawlMarkdown && extraction.iframeUrls && extraction.iframeUrls.length > 0) {
        console.log(`[Seer BG] Crawl server unavailable, fetching ${extraction.iframeUrls.length} iframe(s) directly...`);
        for (const iframeUrl of extraction.iframeUrls) {
          try {
            const resp = await fetch(iframeUrl);
            if (resp.ok) {
              const html = await resp.text();
              const cleaned = cleanFetchedHtml(html);
              console.log(`[Seer BG] Iframe fetched: ${html.length} → cleaned: ${cleaned.length} chars`);
              if (cleaned.length > rawText.length) rawText = cleaned;
            }
          } catch (err: any) {
            console.log(`[Seer BG] Iframe fetch failed: ${err.message}`);
          }
        }
      }

      console.log(`[Seer BG] Best content: ${rawText.length} chars — sending to Grok`);

      const t0 = Date.now();
      const combined = await extractAndAnalyzeViaGrok({
        rawText,
        jsonLd: extraction.jsonLd,
        profile: settings.profile,
        baseResumeSummaries: settings.baseResumeSummaries,
        url: extraction.url,
        pageTitle: extraction.pageTitle,
      });
      console.log(`[Seer BG] Grok responded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      console.log(`[Seer BG] Extracted: "${combined.job.title}" @ ${combined.job.company}`);
      console.log(`[Seer BG] Fit: ${combined.analysis.fit_score}/100, base: ${combined.analysis.recommended_base}, rec: ${combined.analysis.apply_recommendation}`);

      const scrapedJob: ScrapedJob = {
        job: combined.job,
        extraction,
        deepAnalysis: combined.analysis,
        geminiModel: combined.model,
        claudePrompt: null,
        scrapedAt: new Date().toISOString(),
      };
      if (senderTabId != null) {
        await saveJobForTab(senderTabId, scrapedJob);
        console.log(`[Seer BG] Saved to storage (tab ${senderTabId})`);
        updateBadge(combined.analysis.fit_score, combined.analysis.fit_score >= 40, senderTabId);
      } else {
        console.log('[Seer BG] No tab ID — skipping storage save');
      }

      return { type: 'DEEP_ANALYSIS_RESULT', result: combined.analysis, job: combined.job, model: combined.model };
    }

    // ─── Generate Claude prompt ───────────────────────────────────
    case 'GENERATE_PROMPT': {
      const { job, analysis } = message;
      console.log(`[Seer BG] Generating Claude prompt (base: ${analysis.recommended_base})`);

      if (!settings.prompts[analysis.recommended_base]) {
        return {
          type: 'ERROR',
          message: `Prompt template for "${analysis.recommended_base}" not found. Re-import your profile.`,
        };
      }

      const prompt = buildClaudePrompt({
        job,
        analysis,
        promptTemplate: settings.prompts[analysis.recommended_base],
        selectedBase: analysis.recommended_base,
      });

      console.log(`[Seer BG] Prompt generated (${prompt.length} chars)`);

      const promptTabId = message.tabId ?? senderTabId;
      if (promptTabId != null) {
        const tabJob = await getJobForTab(promptTabId);
        if (tabJob) {
          tabJob.claudePrompt = prompt;
          await saveJobForTab(promptTabId, tabJob);
        }
      }

      return { type: 'PROMPT_RESULT', prompt };
    }

    // ─── Get job for a specific tab ────────────────────────────────
    case 'GET_JOB_FOR_TAB': {
      const data = await getJobForTab(message.tabId);
      console.log(`[Seer BG] GET_JOB_FOR_TAB (tab ${message.tabId}): ${data ? `"${data.job.title}"` : 'null'}`);
      return { type: 'CURRENT_JOB_RESULT', data };
    }

    // ─── Legacy: Get current job (kept for backward compat) ──────
    case 'GET_CURRENT_JOB': {
      // If sent from a content script tab, return that tab's job
      if (senderTabId != null) {
        const data = await getJobForTab(senderTabId);
        console.log(`[Seer BG] GET_CURRENT_JOB (tab ${senderTabId}): ${data ? `"${data.job.title}"` : 'null'}`);
        return { type: 'CURRENT_JOB_RESULT', data };
      }
      return { type: 'CURRENT_JOB_RESULT', data: null };
    }

    default:
      console.log(`[Seer BG] Unknown message type: ${(message as any).type}`);
      return { type: 'ERROR', message: 'Unknown message type' };
  }
}

function updateBadge(score: number, pass: boolean, tabId?: number) {
  const color = pass ? '#10b981' : '#ef4444';
  if (tabId != null) {
    chrome.action.setBadgeText({ text: `${score}`, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  } else {
    chrome.action.setBadgeText({ text: `${score}` });
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

const CRAWL_SERVER = 'http://localhost:9742';

/**
 * Try Crawl4AI server: page URL first, then iframe URLs if result is too short.
 * Returns markdown string or null if server is unavailable.
 */
async function tryCrawlServer(pageUrl: string, iframeUrls?: string[]): Promise<string | null> {
  try {
    // Health check — don't waste time if server is down
    const health = await fetch(`${CRAWL_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    if (!health.ok) return null;
  } catch {
    console.log('[Seer BG] Crawl server not running — skipping');
    return null;
  }

  // Try page URL first
  console.log(`[Seer BG] Crawl4AI: crawling ${pageUrl}`);
  let best = await crawlOne(pageUrl);
  console.log(`[Seer BG] Crawl4AI: page URL returned ${best?.length || 0} chars`);

  // Always try iframe URLs if they exist — iframe content is usually the actual JD
  if (iframeUrls && iframeUrls.length > 0) {
    for (const iframeUrl of iframeUrls) {
      console.log(`[Seer BG] Crawl4AI: trying iframe ${iframeUrl}`);
      const md = await crawlOne(iframeUrl);
      if (md && md.length > (best?.length || 0)) {
        console.log(`[Seer BG] Crawl4AI: iframe returned ${md.length} chars (better than page ${best?.length || 0})`);
        best = md;
      }
    }
  }

  return best && best.length > 500 ? best : null;
}

async function crawlOne(url: string): Promise<string | null> {
  try {
    const resp = await fetch(`${CRAWL_SERVER}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.success ? data.markdown : null;
  } catch (err: any) {
    console.log(`[Seer BG] Crawl4AI error: ${err.message}`);
    return null;
  }
}

/** Strip images, empty links, and noise from Crawl4AI markdown. */
function cleanCrawlMarkdown(md: string): string {
  return md
    // Remove markdown images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Remove empty links: [](url)
    .replace(/\[\s*\]\([^)]*\)/g, '')
    // Remove standalone image URLs on their own line
    .replace(/^\s*https?:\/\/\S+\.(png|jpg|jpeg|gif|svg|webp|ico)\S*\s*$/gmi, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Strip scripts, styles, and noise from fetched HTML (runs in service worker, no DOM). */
function cleanFetchedHtml(html: string): string {
  return html
    // Remove script tags and content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove link/meta/noscript tags
    .replace(/<(link|meta|noscript)[^>]*\/?>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove all tag attributes except href
    .replace(/<(\w+)\s+[^>]*?(href="[^"]*")?[^>]*?>/gi, (_m, tag, href) =>
      href ? `<${tag} ${href}>` : `<${tag}>`
    )
    // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
