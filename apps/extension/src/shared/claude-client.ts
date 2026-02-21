/**
 * The Seer — Claude client via chrome.scripting.executeScript.
 * Opens claude.ai project chat, pastes the prompt, clicks send.
 * Same pattern as grok-client.ts: fire-and-forget automation with message callback.
 */

const CLAUDE_PROJECT_URL = 'https://claude.ai/project/019af037-9894-7058-8e80-376f028729c2';

/**
 * Open a new Claude chat in the project, paste the prompt, and submit it.
 * Resolves when the prompt has been submitted (does NOT wait for Claude's response).
 */
export async function submitPromptToClaude(prompt: string): Promise<void> {
  console.log(`[Seer Claude] Opening Claude project chat...`);
  const tab = await chrome.tabs.create({ url: CLAUDE_PROJECT_URL, active: false });
  const tabId = tab.id!;
  await waitForTabLoad(tabId);
  console.log(`[Seer Claude] Tab loaded (${tabId}), injecting automation...`);

  const requestId = crypto.randomUUID();

  const resultPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('Claude automation timed out after 30s'));
    }, 30_000);

    const listener = (msg: any) => {
      if (msg?.type === 'SEER_CLAUDE_RESULT' && msg.requestId === requestId) {
        chrome.runtime.onMessage.removeListener(listener);
        clearTimeout(timeout);
        if (msg.error) reject(new Error(msg.error));
        else resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    func: claudeAutomation,
    args: [prompt, requestId],
  });
  console.log(`[Seer Claude] Automation injected (requestId: ${requestId}), waiting for submit...`);

  await resultPromise;
  console.log(`[Seer Claude] Prompt submitted successfully`);
}

// ─── Tab management ───────────────────────────────────────────────────

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000); // Let Claude's React app fully hydrate
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ─── Automation function (serialized & executed in claude.ai tab) ─────

/**
 * Runs INSIDE the claude.ai tab via chrome.scripting.executeScript.
 * Must be entirely self-contained — no imports, no external references.
 */
function claudeAutomation(prompt: string, requestId: string): void {
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const sendSuccess = () => {
    chrome.runtime.sendMessage({ type: 'SEER_CLAUDE_RESULT', requestId });
  };
  const sendError = (error: string) => {
    chrome.runtime.sendMessage({ type: 'SEER_CLAUDE_RESULT', requestId, error });
  };

  (async () => {
    try {
      // ── Step 1: Wait for ProseMirror chat input ──
      console.log('[Seer Claude] Step 1: Waiting for chat input...');
      let input: HTMLElement | null = null;
      for (let i = 0; i < 50; i++) {
        input = document.querySelector('div[data-testid="chat-input"]') as HTMLElement;
        if (input) break;
        await sleep(200);
      }
      if (!input) { sendError('Chat input not found after 10s'); return; }
      await sleep(500); // Let ProseMirror fully initialize

      // ── Step 2: Paste prompt ──
      console.log('[Seer Claude] Step 2: Pasting prompt...');
      input.focus();
      await sleep(100);

      // Clear existing content
      const p = input.querySelector('p');
      if (p) { p.innerHTML = ''; }

      const cd = new DataTransfer();
      cd.setData('text/plain', prompt);
      input.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData: cd,
      }));

      await sleep(500);
      const pastedLen = input.innerText.trim().length;
      console.log(`[Seer Claude] Pasted: ${pastedLen} chars (expected ~${prompt.length})`);

      // Fallback if paste was truncated
      if (pastedLen < prompt.length * 0.5) {
        console.log('[Seer Claude] Paste truncated — using innerText fallback');
        input.innerText = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500);
      }

      // ── Step 3: Find and click send button ──
      console.log('[Seer Claude] Step 3: Looking for send button...');
      await sleep(500); // Let UI react to pasted content

      const SEND_SELECTORS = [
        'button[aria-label="Send Message"]',
        'button[data-testid="send-button"]',
        'button[aria-label="Send"]',
      ];

      let sendBtn: HTMLButtonElement | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        for (const sel of SEND_SELECTORS) {
          sendBtn = document.querySelector(sel) as HTMLButtonElement;
          if (sendBtn) break;
        }
        if (sendBtn) break;
        await sleep(300);
      }

      if (sendBtn) {
        console.log('[Seer Claude] Found send button, clicking...');
        sendBtn.click();
      } else {
        // Fallback: press Enter on the ProseMirror input
        console.log('[Seer Claude] No send button found — pressing Enter...');
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        }));
      }

      await sleep(500);
      console.log('[Seer Claude] Prompt submitted!');
      sendSuccess();
    } catch (err: any) {
      console.error('[Seer Claude] Automation error:', err);
      sendError(err.message || 'Unknown automation error');
    }
  })();
}
