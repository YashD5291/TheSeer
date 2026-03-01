/**
 * The Seer — Dashboard tracker (fire-and-forget).
 * All calls are wrapped in try/catch so tracking failures NEVER block
 * the analysis pipeline.
 */

import { getSettings } from './storage.js';

const TAG = '[Seer Tracker]';

// ─── Internal helper ──────────────────────────────────────────────────

async function apiCall(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<any> {
  const settings = await getSettings();
  const baseUrl = settings.dashboardUrl || 'http://localhost:3000';
  const url = `${baseUrl}${path}`;

  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${method} ${path} → ${resp.status}: ${text}`);
  }

  return resp.json();
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Sync a prompt to the dashboard. Returns the prompt _id and version,
 * or null if the sync fails.
 */
export async function syncPrompt(data: {
  key: string;
  content: string;
  category: string;
  title: string;
}): Promise<{ _id: string; version: number } | null> {
  try {
    console.log(`${TAG} syncPrompt: ${data.key}`);
    const result = await apiCall('POST', '/api/prompts', data);
    console.log(`${TAG} Prompt synced: ${data.key} v${result.version} (${result.existing ? 'existing' : 'new'})`);
    return { _id: result._id as string, version: result.version as number };
  } catch (err: any) {
    console.log(`${TAG} syncPrompt failed: ${err.message}`);
    return null;
  }
}

/**
 * Create a new job record in the dashboard. Returns the MongoDB _id.
 */
export async function trackJobCreated(data: Record<string, unknown>): Promise<string> {
  try {
    console.log(`${TAG} trackJobCreated: ${data.title} @ ${data.company}`);

    // Attach prompt version IDs if available
    const settings = await getSettings();
    if (Object.keys(settings.promptIds).length > 0) {
      const promptVersions: Record<string, string> = {};
      if (settings.promptIds.grok_extraction) {
        promptVersions.grok = settings.promptIds.grok_extraction;
      }
      // Find the claude prompt ID based on recommended base
      const claudeKey = data.recommendedBase
        ? `claude_${data.recommendedBase}`
        : null;
      if (claudeKey && settings.promptIds[claudeKey]) {
        promptVersions.claude = settings.promptIds[claudeKey];
      }
      if (Object.keys(promptVersions).length > 0) {
        data.promptVersions = promptVersions;
      }
    }

    const result = await apiCall('POST', '/api/jobs', data);
    console.log(`${TAG} Job created: ${result._id}`);
    return result._id as string;
  } catch (err: any) {
    console.log(`${TAG} trackJobCreated failed: ${err.message}`);
    return '';
  }
}

/**
 * Append an event to an existing job's event timeline.
 */
export async function trackEvent(
  jobId: string,
  event: { type: string; durationMs?: number; metadata?: Record<string, unknown> }
): Promise<void> {
  if (!jobId) return;
  try {
    console.log(`${TAG} trackEvent: ${event.type} (job: ${jobId})`);
    await apiCall('POST', '/api/events', { jobId, ...event });
  } catch (err: any) {
    console.log(`${TAG} trackEvent failed: ${err.message}`);
  }
}

/**
 * Update a job with Claude-related data (prompt sent, response received, chat URL, timing).
 */
export async function trackClaudeData(
  jobId: string,
  data: {
    claudePrompt?: string;
    claudeResponse?: string;
    claudeChatUrl?: string;
    claudeResponseMs?: number;
    claudePromptKey?: string;
  }
): Promise<void> {
  if (!jobId) return;
  try {
    console.log(`${TAG} trackClaudeData: job ${jobId} (response: ${data.claudeResponse?.length || 0} chars)`);
    const body: Record<string, unknown> = {};
    if (data.claudePrompt !== undefined) body.claudePrompt = data.claudePrompt;
    if (data.claudeResponse !== undefined) body.claudeResponse = data.claudeResponse;
    if (data.claudeChatUrl !== undefined) body.claudeChatUrl = data.claudeChatUrl;
    if (data.claudeResponseMs !== undefined) {
      body.timing = { claudeResponseMs: data.claudeResponseMs };
    }

    // Attach claude prompt version ID if available
    if (data.claudePromptKey) {
      const settings = await getSettings();
      const claudeId = settings.promptIds[data.claudePromptKey];
      if (claudeId) {
        body.promptVersions = { claude: claudeId };
      }
    }

    await apiCall('PATCH', `/api/jobs/${jobId}`, body);
    console.log(`${TAG} Claude data saved for job ${jobId}`);
  } catch (err: any) {
    console.log(`${TAG} trackClaudeData failed: ${err.message}`);
  }
}

/**
 * Update a job with resume generation data (LaTeX source, PDF binary, timing).
 */
export async function trackResumeGenerated(
  jobId: string,
  data: {
    latexSource?: string;
    pdfBase64?: string;
    pdfSizeBytes?: number;
    folderName?: string;
    pdfMs?: number;
  }
): Promise<void> {
  if (!jobId) return;
  try {
    console.log(`${TAG} trackResumeGenerated: job ${jobId} (folder: ${data.folderName})`);
    const body: Record<string, unknown> = {
      resume: {
        latexSource: data.latexSource,
        pdfBase64: data.pdfBase64,
        pdfSizeBytes: data.pdfSizeBytes,
        folderName: data.folderName,
      },
      status: 'resume_created',
    };
    if (data.pdfMs !== undefined) {
      body.timing = { pdfMs: data.pdfMs };
    }
    await apiCall('PATCH', `/api/jobs/${jobId}`, body);
    console.log(`${TAG} Resume data saved for job ${jobId}`);
  } catch (err: any) {
    console.log(`${TAG} trackResumeGenerated failed: ${err.message}`);
  }
}
