/**
 * The Seer — Grok client via chrome.scripting.executeScript.
 * Opens grok.com, runs a self-contained automation function in the tab,
 * returns the response. No content script, no message passing.
 */

import type { JobData, ParsedProfile, FitAnalysis, BaseResumeSlug } from './types.js';
import { getDefaultPrompt, interpolateTemplate } from './prompt-defaults.js';
import { getSystemPrompts } from './storage.js';

export interface GrokResponse {
  text: string;
  model: 'grok-chat';
}

/**
 * Send a prompt to Grok and get the response back.
 * Opens a fresh grok.com chat, pastes the prompt, waits for
 * streaming to complete, extracts the response — all via executeScript.
 */
export async function callGrok(prompt: string): Promise<GrokResponse> {
  const tabId = await getOrOpenFreshGrokTab();
  console.log(`[Seer Grok] Tab ready (${tabId}), executing automation (${prompt.length} chars)...`);

  const t0 = Date.now();

  // Set up a one-time listener for the result BEFORE injecting
  const resultPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('Grok automation timed out after 130s'));
    }, 130_000);

    const listener = (msg: any) => {
      if (msg?.type === 'SEER_GROK_RESULT') {
        chrome.runtime.onMessage.removeListener(listener);
        clearTimeout(timeout);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.text);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });

  // Inject the automation function (fire-and-forget — result comes via message)
  await chrome.scripting.executeScript({
    target: { tabId },
    func: grokAutomation,
    args: [prompt],
  });
  console.log('[Seer Grok] Automation injected, waiting for result...');

  const text = await resultPromise;

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[Seer Grok] Response in ${elapsed}s (${text.length} chars)`);
  return { text, model: 'grok-chat' };
}

// ─── Tab management (runs in background) ─────────────────────────────

async function getOrOpenFreshGrokTab(): Promise<number> {
  const tabs = await chrome.tabs.query({ url: ['https://grok.com/*', 'https://x.com/i/grok*'] });

  if (tabs.length > 0 && tabs[0].id != null) {
    const tabId = tabs[0].id;
    console.log(`[Seer Grok] Found existing tab ${tabId} — ${tabs[0].url}`);

    // Navigate to fresh chat if it's on a conversation page
    const url = tabs[0].url || '';
    if (url !== 'https://grok.com/' && !url.endsWith('grok.com')) {
      console.log('[Seer Grok] Navigating to fresh chat...');
      await chrome.tabs.update(tabId, { url: 'https://grok.com/' });
      await waitForTabLoad(tabId);
    }
    return tabId;
  }

  console.log('[Seer Grok] Opening new grok.com tab...');
  const newTab = await chrome.tabs.create({ url: 'https://grok.com/', active: false });
  await waitForTabLoad(newTab.id!);
  console.log(`[Seer Grok] New tab loaded (${newTab.id})`);
  return newTab.id!;
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500); // Let Grok's JS framework initialize
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ─── Automation function (serialized & executed in grok.com tab) ─────

/**
 * This function runs INSIDE the grok.com tab via chrome.scripting.executeScript.
 * It must be entirely self-contained — no imports, no external references.
 * Sends the result back via chrome.runtime.sendMessage (fire-and-forget pattern).
 */
function grokAutomation(prompt: string): void {
  const SELECTORS = {
    chatInput: '.query-bar div.tiptap.ProseMirror[contenteditable="true"]',
    chatInputFallback: 'div.ProseMirror[contenteditable="true"]',
    sendButton: 'button[aria-label="Submit"]',
    responseContainer: '.items-start .response-content-markdown',
    streamingIndicator: '.animate-gaussian',
    cleanTextRemove: 'button, svg, img, .animate-gaussian, .citation',
  };

  const MAX_WAIT = 120_000;
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // Send result back to background
  const sendResult = (text: string) => {
    chrome.runtime.sendMessage({ type: 'SEER_GROK_RESULT', text });
  };
  const sendError = (error: string) => {
    chrome.runtime.sendMessage({ type: 'SEER_GROK_RESULT', error });
  };

  // Run the automation as an async IIFE
  (async () => {
    try {
      // ── Step 1: Wait for chat input ──
      console.log('[Seer Grok] Step 1: Waiting for chat input...');
      let input: HTMLElement | null = null;
      for (let i = 0; i < 50; i++) {
        input = (document.querySelector(SELECTORS.chatInput) ||
                 document.querySelector(SELECTORS.chatInputFallback)) as HTMLElement;
        if (input) break;
        await sleep(200);
      }
      if (!input) { sendError('Chat input not found after 10s'); return; }
      await sleep(500); // Let ProseMirror fully initialize

      // ── Step 2: Paste prompt ──
      console.log('[Seer Grok] Step 2: Pasting prompt...');
      input.innerHTML = '';
      input.focus();
      await sleep(100);

      const cd = new DataTransfer();
      cd.setData('text/plain', prompt);
      input.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData: cd,
      }));

      await sleep(300);
      const pastedLen = input.innerText.trim().length;
      console.log(`[Seer Grok] Pasted: ${pastedLen} chars (expected ~${prompt.length})`);

      // Fallback if paste was truncated
      if (pastedLen < prompt.length * 0.5) {
        console.log('[Seer Grok] Paste truncated — using innerText fallback');
        input.innerText = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(300);
      }

      // ── Step 3: Click send ──
      const beforeCount = document.querySelectorAll(SELECTORS.responseContainer).length;

      const sendBtn = document.querySelector(SELECTORS.sendButton) as HTMLButtonElement;
      if (!sendBtn) { sendError('Send button not found'); return; }
      sendBtn.click();
      console.log('[Seer Grok] Step 3: Prompt sent, waiting for response...');

      // ── Step 4: Wait for new response container ──
      await new Promise<void>((resolve, reject) => {
        if (document.querySelectorAll(SELECTORS.responseContainer).length > beforeCount) {
          return resolve();
        }
        const timeout = setTimeout(() => { obs.disconnect(); reject(new Error('No response after 120s')); }, MAX_WAIT);
        const obs = new MutationObserver(() => {
          if (document.querySelectorAll(SELECTORS.responseContainer).length > beforeCount) {
            obs.disconnect(); clearTimeout(timeout); resolve();
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
      console.log('[Seer Grok] Step 4: Response container detected');

      // ── Step 5: Wait for streaming to end (globally) ──
      // First wait a bit for streaming indicator to appear (race condition guard)
      console.log('[Seer Grok] Step 5: Waiting for streaming to complete...');
      await sleep(2000); // Give Grok time to start streaming
      const hasIndicator = !!document.querySelector(SELECTORS.streamingIndicator);
      console.log(`[Seer Grok] Step 5: Streaming indicator present after 2s wait: ${hasIndicator}`);

      if (hasIndicator) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => { obs.disconnect(); resolve(); }, MAX_WAIT);
          const obs = new MutationObserver(() => {
            if (!document.querySelector(SELECTORS.streamingIndicator)) {
              obs.disconnect(); clearTimeout(timeout); resolve();
            }
          });
          obs.observe(document.body, { childList: true, subtree: true });
        });
      } else {
        // No indicator found — poll for content to stabilize instead
        console.log('[Seer Grok] Step 5: No streaming indicator — polling for stable content...');
        let lastLen = 0;
        let stableCount = 0;
        for (let i = 0; i < 60; i++) { // up to 60s
          await sleep(1000);
          const el = document.querySelector(SELECTORS.responseContainer)
                  || document.querySelector('.response-content-markdown')
                  || document.querySelector('[class*="response"]');
          const curLen = el?.textContent?.length || 0;
          if (curLen > 0 && curLen === lastLen) {
            stableCount++;
            if (stableCount >= 3) break; // 3s of stable content = done
          } else {
            stableCount = 0;
          }
          lastLen = curLen;
        }
      }
      console.log('[Seer Grok] Step 5: Streaming complete');

      await sleep(1000); // Final settle

      // ── Step 6: Extract response text ──
      // Try multiple selector strategies — grok.com DOM changes frequently
      const RESPONSE_SELECTORS = [
        SELECTORS.responseContainer,                    // .items-start .response-content-markdown
        '.response-content-markdown',                   // Without parent constraint
        '.message-bubble:last-of-type',                 // Message bubble pattern
        '[class*="response"] [class*="markdown"]',      // Fuzzy match
        '[data-testid="message-content"]',              // Test ID pattern
      ];

      let text = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        // Try each selector
        for (const sel of RESPONSE_SELECTORS) {
          const containers = document.querySelectorAll(sel);
          if (containers.length === 0) continue;
          const latest = containers[containers.length - 1];
          const clone = latest.cloneNode(true) as HTMLElement;
          clone.querySelectorAll(SELECTORS.cleanTextRemove).forEach(el => el.remove());
          const extracted = clone.innerText?.trim() || '';
          console.log(`[Seer Grok] Step 6: Attempt ${attempt + 1}, selector "${sel}": ${containers.length} matches, ${extracted.length} chars`);
          if (extracted.length > text.length) {
            text = extracted;
          }
        }
        if (text) break;
        console.log(`[Seer Grok] Step 6: Attempt ${attempt + 1}: no text found, waiting...`);
        await sleep(1000);
      }

      if (!text) {
        // Last resort: dump all classes for debugging
        const allEls = document.querySelectorAll('[class*="response"], [class*="markdown"], [class*="message"]');
        const classes = Array.from(allEls).slice(0, 10).map(e => e.className);
        console.log(`[Seer Grok] Step 6: FAILED — nearby classes: ${JSON.stringify(classes)}`);
        sendError('Grok response was empty — selectors may be outdated. Check grok.com tab console for class names.');
        return;
      }

      console.log(`[Seer Grok] Done! Sending ${text.length} chars back to background`);
      sendResult(text);
    } catch (err: any) {
      console.error('[Seer Grok] Automation error:', err);
      sendError(err.message || 'Unknown automation error');
    }
  })();
}

// ─── Combined extraction + analysis ──────────────────────────────────

export interface CombinedResult {
  job: JobData;
  analysis: FitAnalysis;
  model: string;
}

export async function extractAndAnalyzeViaGrok(params: {
  rawText: string;
  jsonLd: any | null;
  profile: ParsedProfile;
  baseResumeSummaries: Record<BaseResumeSlug, string>;
  url: string;
  pageTitle: string;
}): Promise<CombinedResult> {
  const { rawText, jsonLd, profile, baseResumeSummaries, url, pageTitle } = params;

  const overrides = await getSystemPrompts();
  const template = overrides['grok_extraction'] || getDefaultPrompt('grok_extraction');

  const vars: Record<string, string> = {
    url,
    pageTitle,
    jsonLdSection: jsonLd ? `JSON-LD: ${JSON.stringify(jsonLd).slice(0, 2000)}` : '',
    rawText: rawText.slice(0, 12000),
    skillsExpert: profile.skills_expert.join(', '),
    skillsProficient: profile.skills_proficient.join(', '),
    skillsFamiliar: profile.skills_familiar.join(', '),
    experienceYears: String(profile.experience_years),
    titlesHeld: profile.titles_held.join(', '),
    targetTitles: profile.target_titles.join(', ') || 'Any',
    dealBreakers: profile.deal_breakers.join(', ') || 'None',
    baseSummaryGenAi: baseResumeSummaries.gen_ai,
    baseSummaryMle: baseResumeSummaries.mle,
    baseSummaryMix: baseResumeSummaries.mix,
  };

  const prompt = interpolateTemplate(template, vars);
  const { text } = await callGrok(prompt);
  const parsed = parseGrokTextResponse(text, url);
  return { ...parsed, model: 'grok-chat' };
}

// ─── Text format parser ──────────────────────────────────────────────

function parseGrokTextResponse(text: string, url: string): { job: JobData; analysis: FitAnalysis } {
  const getField = (key: string): string => {
    const regex = new RegExp(`^${key}:\\s*(.+)`, 'mi');
    const match = text.match(regex);
    return match?.[1]?.trim() || '';
  };

  const getList = (key: string): string[] => {
    const val = getField(key);
    if (!val) return [];
    return val.split('|').map(s => s.trim()).filter(Boolean);
  };

  let description = '';
  const descMatch = text.match(/DESCRIPTION:\s*([\s\S]*?)===END_DESCRIPTION===/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    description = getField('DESCRIPTION');
  }

  const title = getField('JOB_TITLE');
  if (!title) {
    throw new Error('Could not parse Grok response — missing JOB_TITLE field');
  }

  const fitScore = parseInt(getField('FIT_SCORE'), 10);
  if (isNaN(fitScore)) {
    throw new Error('Could not parse Grok response — missing FIT_SCORE field');
  }

  const job: JobData = {
    title,
    company: getField('COMPANY') || 'Unknown',
    url,
    location: getField('LOCATION') || undefined,
    salary_range: getField('SALARY') || undefined,
    job_type: getField('JOB_TYPE') || undefined,
    description,
    requirements: getList('REQUIREMENTS'),
    nice_to_haves: getList('NICE_TO_HAVES'),
    platform: 'grok-extracted',
  };

  const recBase = getField('RECOMMENDED_BASE') as 'gen_ai' | 'mle' | 'mix';
  const analysis: FitAnalysis = {
    fit_score: fitScore,
    confidence: parseInt(getField('CONFIDENCE'), 10) || 70,
    recommended_base: ['gen_ai', 'mle', 'mix'].includes(recBase) ? recBase : 'mix',
    base_reasoning: getField('BASE_REASONING'),
    key_matches: getList('KEY_MATCHES'),
    gaps: getList('GAPS'),
    gap_mitigation: getList('GAP_MITIGATION'),
    tailoring_priorities: getList('TAILORING_PRIORITIES'),
    ats_keywords: getList('ATS_KEYWORDS'),
    red_flags: getList('RED_FLAGS'),
    estimated_competition: (getField('COMPETITION') as 'low' | 'medium' | 'high') || 'medium',
    apply_recommendation: (getField('RECOMMENDATION') as 'strong_yes' | 'yes' | 'maybe' | 'no') || 'maybe',
  };

  return { job, analysis };
}
