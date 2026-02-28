import { getSettings, saveJobForTab, getJobForTab, removeJobForTab, getEnabled } from '../shared/storage.js';
import { extractAndAnalyzeViaGrok } from '../shared/grok-client.js';
import { buildClaudePrompt } from '../shared/prompt-builder.js';
import { submitPromptToClaude } from '../shared/claude-client.js';
import { trackJobCreated, trackClaudeData, trackResumeGenerated } from '../shared/tracker.js';
import type { ScrapedJob, MessageType } from '../shared/types.js';

const NATIVE_HOST = 'com.theseer.resumegen';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  // Grok/Claude automation results are handled by one-time listeners — skip here
  if ((message as any).type === 'SEER_GROK_RESULT') return;
  if ((message as any).type === 'SEER_CLAUDE_RESULT') return;
  if ((message as any).type === 'SEER_CLAUDE_RESPONSE_READY') return;
  // Toggle messages are handled by content script directly
  if ((message as any).type === 'SEER_TOGGLE') return;

  // Open PDF in a new tab
  if ((message as any).type === 'SEER_OPEN_PDF') {
    const pdfPath = (message as any).pdfPath as string;
    if (pdfPath) {
      chrome.tabs.create({ url: `file://${pdfPath}` });
    }
    return;
  }

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
      const t_start = performance.now();
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

      const t_crawl_start = performance.now();

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

      const t_crawl_end = performance.now();

      console.log(`[Seer BG] Best content: ${rawText.length} chars — sending to Grok`);

      const t_grok_start = performance.now();
      const combined = await extractAndAnalyzeViaGrok({
        rawText,
        jsonLd: extraction.jsonLd,
        profile: settings.profile,
        baseResumeSummaries: settings.baseResumeSummaries,
        url: extraction.url,
        pageTitle: extraction.pageTitle,
      });
      const t_grok_end = performance.now();
      console.log(`[Seer BG] Grok responded in ${((t_grok_end - t_grok_start) / 1000).toFixed(1)}s`);
      console.log(`[Seer BG] Extracted: "${combined.job.title}" @ ${combined.job.company}`);
      console.log(`[Seer BG] Fit: ${combined.analysis.fit_score}/100, base: ${combined.analysis.recommended_base}, rec: ${combined.analysis.apply_recommendation}`);

      // Auto-build Claude prompt if template exists for the recommended base
      let claudePrompt: string | undefined;
      const promptTemplate = settings.prompts[combined.analysis.recommended_base];
      if (promptTemplate) {
        claudePrompt = buildClaudePrompt({
          job: combined.job,
          analysis: combined.analysis,
          promptTemplate,
          selectedBase: combined.analysis.recommended_base,
          includeContext: settings.seerContext,
        });
        console.log(`[Seer BG] Auto-built Claude prompt (${claudePrompt.length} chars, base: ${combined.analysis.recommended_base})`);
      } else {
        console.log(`[Seer BG] No prompt template for "${combined.analysis.recommended_base}" — skipping auto-prompt`);
      }

      // ── Track job in dashboard (fire-and-forget) ──
      const crawlMs = Math.round(t_crawl_end - t_crawl_start);
      const grokMs = Math.round(t_grok_end - t_grok_start);
      const extractionMs = Math.round(performance.now() - t_start);
      trackJobCreated({
        title: combined.job.title,
        company: combined.job.company,
        url: combined.job.url || extraction.url,
        location: combined.job.location,
        salaryRange: combined.job.salary_range,
        jobType: combined.job.job_type,
        description: combined.job.description,
        requirements: combined.job.requirements,
        niceToHaves: combined.job.nice_to_haves,
        platform: combined.job.platform,
        extraction: {
          method: extraction.extractionMethod,
          rawTextLength: extraction.rawText.length,
          iframeUrls: extraction.iframeUrls || [],
          hadJsonLd: !!extraction.jsonLd,
        },
        analysis: {
          fitScore: combined.analysis.fit_score,
          confidence: combined.analysis.confidence,
          recommendedBase: combined.analysis.recommended_base,
          baseReasoning: combined.analysis.base_reasoning,
          keyMatches: combined.analysis.key_matches,
          gaps: combined.analysis.gaps,
          gapMitigation: combined.analysis.gap_mitigation,
          tailoringPriorities: combined.analysis.tailoring_priorities,
          atsKeywords: combined.analysis.ats_keywords,
          redFlags: combined.analysis.red_flags,
          estimatedCompetition: combined.analysis.estimated_competition,
          applyRecommendation: combined.analysis.apply_recommendation,
        },
        models: {
          grok: settings.grokModel,
          claude: settings.claudeModel,
          claudeExtendedThinking: settings.claudeExtendedThinking,
        },
        timing: {
          extractionMs,
          crawlMs,
          grokMs,
        },
        claudePrompt: claudePrompt || undefined,
        status: 'analyzed',
      }).then((dashboardJobId) => {
        if (dashboardJobId && senderTabId != null) {
          // Store dashboard _id keyed by tab for later Claude/PDF tracking
          chrome.storage.session.set({ [`seer_dashboard_job_${senderTabId}`]: dashboardJobId }).catch(() => {});
          console.log(`[Seer Tracker] Stored dashboard job ${dashboardJobId} for tab ${senderTabId}`);
        }
      }).catch(() => {});

      const scrapedJob: ScrapedJob = {
        job: combined.job,
        extraction,
        deepAnalysis: combined.analysis,
        claudePrompt: claudePrompt || null,
        scrapedAt: new Date().toISOString(),
      };
      if (senderTabId != null) {
        await saveJobForTab(senderTabId, scrapedJob);
        console.log(`[Seer BG] Saved to storage (tab ${senderTabId})`);
        updateBadge(combined.analysis.fit_score, combined.analysis.fit_score >= 40, senderTabId);
      } else {
        console.log('[Seer BG] No tab ID — skipping storage save');
      }

      // Fire off Claude submission (non-blocking)
      if (claudePrompt && senderTabId != null) {
        const jdTabId = senderTabId;
        const jobCompany = combined.job.company;
        const jobTitle = combined.job.title;
        submitPromptToClaude(claudePrompt, settings.claudeModel, settings.claudeExtendedThinking)
          .then((claudeTabId) => {
            console.log(`[Seer BG] Claude prompt submitted (claude tab: ${claudeTabId})`);
            chrome.tabs.sendMessage(jdTabId, { type: 'SEER_CLAUDE_DONE' }).catch(() => {});
            // Start alarm-based polling for response completion
            startClaudeResponsePolling(claudeTabId, jdTabId, jobCompany, jobTitle);
          })
          .catch(err => {
            console.log(`[Seer BG] Claude submission failed: ${err.message}`);
            chrome.tabs.sendMessage(jdTabId, { type: 'SEER_CLAUDE_ERROR', message: err.message }).catch(() => {});
          });
      }

      return { type: 'DEEP_ANALYSIS_RESULT', result: combined.analysis, job: combined.job, model: combined.model, claudePrompt };
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
        includeContext: settings.seerContext,
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

// ─── Claude response detection ──────────────────────────────────────
//
// Primary: Hook Claude's own Notification API call. When Claude.ai fires
// its "Claude responded" notification, our MAIN-world hook intercepts it
// and relays to the background. This fires at the exact same moment as
// Claude's standard notification — proven to work in background tabs
// (Chrome defers DOM updates/rAF but NOT Notification constructor calls).
//
// Fallback: chrome.alarms hard timeout at 10min.

const CLAUDE_POLL_ALARM = 'seer-claude-poll';

interface ClaudePollState {
  claudeTabId: number;
  jdTabId: number;
  startedAt: number;
  jobCompany?: string;
  jobTitle?: string;
}

async function startClaudeResponsePolling(claudeTabId: number, jdTabId: number, jobCompany?: string, jobTitle?: string) {
  const state: ClaudePollState = { claudeTabId, jdTabId, startedAt: Date.now(), jobCompany, jobTitle };
  await chrome.storage.session.set({ claudePollState: state });
  // The Notification hook is injected via manifest content_scripts (MAIN world,
  // document_start) so it's already in place before Claude's JS even loads.
  // The ISOLATED world content script relays the event to us as SEER_CLAUDE_RESPONSE_READY.
  // Hard-timeout alarm fallback in case the hook doesn't fire.
  chrome.alarms.create(CLAUDE_POLL_ALARM, { delayInMinutes: 10 });
  console.log(`[Seer BG] Monitoring Claude response (tab: ${claudeTabId}, jd: ${jdTabId})`);
}

// ── Listen for fetch-hook signal from Claude tab ──
chrome.runtime.onMessage.addListener((msg: any, sender) => {
  if (msg?.type !== 'SEER_CLAUDE_RESPONSE_READY') return;

  chrome.storage.session.get('claudePollState').then(data => {
    const state = data.claudePollState as ClaudePollState | undefined;
    if (!state) return;
    if (sender.tab?.id !== state.claudeTabId) return;

    console.log(`[Seer BG] Claude response intercepted via fetch hook (${msg.responseText?.length || 0} chars)`);
    onClaudeResponseComplete(state, msg.chatUrl, msg.responseText);
  });
});

// Hard timeout fallback
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CLAUDE_POLL_ALARM) return;

  const data = await chrome.storage.session.get('claudePollState');
  const state = data.claudePollState as ClaudePollState | undefined;
  if (!state) {
    chrome.alarms.clear(CLAUDE_POLL_ALARM);
    return;
  }

  console.log('[Seer BG] 10min hard timeout — assuming Claude finished');
  await onClaudeResponseComplete(state);
});

async function onClaudeResponseComplete(state: ClaudePollState, hookChatUrl?: string, responseText?: string) {
  chrome.alarms.clear(CLAUDE_POLL_ALARM);
  await chrome.storage.session.remove('claudePollState');

  let chatUrl = hookChatUrl || '';
  if (!chatUrl) {
    try {
      const tab = await chrome.tabs.get(state.claudeTabId);
      chatUrl = tab.url || '';
    } catch { /* tab gone */ }
  }

  console.log(`[Seer BG] Claude done — chat URL: ${chatUrl}`);
  if (responseText) {
    console.log(`[Seer BG] Claude response (${responseText.length} chars): ${responseText.slice(0, 200)}...`);
  }

  // ── Track Claude data in dashboard (fire-and-forget) ──
  const claudeResponseMs = Date.now() - state.startedAt;
  chrome.storage.session.get(`seer_dashboard_job_${state.jdTabId}`).then(data => {
    const dashboardJobId = data[`seer_dashboard_job_${state.jdTabId}`] as string | undefined;
    if (dashboardJobId) {
      trackClaudeData(dashboardJobId, {
        claudeResponse: responseText,
        claudeChatUrl: chatUrl,
        claudeResponseMs,
      }).catch(() => {});
    }
  }).catch(() => {});

  // Update JD tab panel with chat link + response text
  chrome.tabs.sendMessage(state.jdTabId, {
    type: 'SEER_CLAUDE_RESPONSE_COMPLETE',
    chatUrl,
    responseText,
  }).catch(() => {});

  // Trigger PDF generation via native messaging (non-blocking, silent on failure)
  if (responseText) {
    // Strip "@ Company" suffix from title if Grok appended it (e.g. "Applied AI Engineer @ Arc")
    const cleanTitle = state.jobTitle?.replace(new RegExp(`\\s*@\\s*${state.jobCompany}\\s*$`, 'i'), '') || '';
    const chatTitle = (state.jobCompany && cleanTitle) ? `${state.jobCompany} - ${cleanTitle}` : '';
    console.log(`[Seer BG] PDF: chatTitle="${chatTitle}"`);
    triggerPdfGeneration(responseText, chatTitle, state.jdTabId, state.jobCompany, cleanTitle);
  }
}

function triggerPdfGeneration(responseText: string, chatTitle: string, jdTabId: number, jobCompany?: string, jobTitle?: string) {
  console.log(`[Seer BG] Triggering PDF generation (chatTitle: "${chatTitle}")`);
  const pdfStartedAt = Date.now();

  chrome.runtime.sendNativeMessage(
    NATIVE_HOST,
    { responseText, chatTitle: chatTitle || undefined },
    (response) => {
      if (chrome.runtime.lastError) {
        console.log(`[Seer BG] Native messaging error: ${chrome.runtime.lastError.message}`);
        chrome.tabs.sendMessage(jdTabId, {
          type: 'SEER_PDF_ERROR',
          error: chrome.runtime.lastError.message,
        }).catch(() => {});
        return;
      }

      if (response?.success) {
        console.log(`[Seer BG] PDF generated: ${response.pdfPath}`);
        chrome.tabs.sendMessage(jdTabId, {
          type: 'SEER_PDF_READY',
          pdfPath: response.pdfPath,
          folderName: response.folderName,
        }).catch(() => {});

        // OS notification — dynamic title based on available job info
        const notifTitle = (jobCompany && jobTitle) ? `${jobCompany} — ${jobTitle}`
          : jobCompany ? `${jobCompany} — Resume Ready`
          : jobTitle ? `${jobTitle} — Resume Ready`
          : 'The Seer';
        const notifId = `seer-pdf-${Date.now()}`;
        chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: notifTitle,
          message: 'Your tailored resume is ready — click to open',
        }, (createdId) => {
          if (chrome.runtime.lastError) {
            console.error(`[Seer BG] Notification failed: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`[Seer BG] Notification created: ${createdId}`);
          }
        });
        chrome.storage.session.set({
          [`seer_notif_${notifId}`]: { pdfPath: response.pdfPath },
        });

        // ── Track resume in dashboard (fire-and-forget) ──
        const pdfMs = Date.now() - pdfStartedAt;
        chrome.storage.session.get(`seer_dashboard_job_${jdTabId}`).then(data => {
          const dashboardJobId = data[`seer_dashboard_job_${jdTabId}`] as string | undefined;
          if (dashboardJobId) {
            trackResumeGenerated(dashboardJobId, {
              latexSource: response.latexSource,
              pdfBase64: response.pdfBase64,
              pdfSizeBytes: response.pdfSizeBytes,
              folderName: response.folderName,
              pdfMs,
            }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        console.log(`[Seer BG] PDF generation failed: ${response?.error || 'unknown'}`);
        chrome.tabs.sendMessage(jdTabId, {
          type: 'SEER_PDF_ERROR',
          error: response?.error || 'Unknown error',
        }).catch(() => {});
      }
    }
  );
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  const key = `seer_notif_${notifId}`;
  const data = await chrome.storage.session.get(key);
  const info = data[key] as { pdfPath: string } | undefined;
  if (info?.pdfPath) {
    chrome.tabs.create({ url: `file://${info.pdfPath}` });
    await chrome.storage.session.remove(key);
  }
  chrome.notifications.clear(notifId);
});

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
