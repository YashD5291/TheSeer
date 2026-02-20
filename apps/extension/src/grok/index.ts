/**
 * The Seer — Grok chat automation.
 * Injected on grok.com. Receives prompts from background, types them into chat,
 * waits for streaming to complete (via MutationObserver), and returns the response.
 */

const SELECTORS = {
  chatInput: '.query-bar div.tiptap.ProseMirror[contenteditable="true"]',
  chatInputFallback: 'div.ProseMirror[contenteditable="true"]',
  sendButton: 'button[aria-label="Submit"]',
  responseContainer: '.items-start .response-content-markdown',
  streamingIndicator: '.animate-gaussian',
  cleanTextRemove: 'button, svg, img, .animate-gaussian, .citation',
};

const MAX_WAIT_MS = 120_000;

// ─── Message listener ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GROK_SEND_PROMPT') {
    console.log('[Seer Grok] Received prompt, length:', message.prompt.length);
    handlePrompt(message.prompt)
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (message.type === 'GROK_HEALTH_CHECK') {
    const input = findChatInput();
    const hasConversation = document.querySelectorAll(SELECTORS.responseContainer).length > 0;
    const isStreaming = !!document.querySelector(SELECTORS.streamingIndicator);
    sendResponse({ ready: !!input, hasConversation, isStreaming });
    return false;
  }
});

console.log('[Seer Grok] Content script loaded on grok.com');

// ─── Core prompt handler ─────────────────────────────────────────────

async function handlePrompt(prompt: string): Promise<string> {
  // Wait for any existing streaming to finish first (check GLOBALLY)
  if (document.querySelector(SELECTORS.streamingIndicator)) {
    console.log('[Seer Grok] Waiting for existing stream to finish...');
    await waitForStreamingEnd();
    console.log('[Seer Grok] Existing stream finished');
    await sleep(500);
  }

  // Wait for chat input to be ready
  console.log('[Seer Grok] Waiting for chat input...');
  const input = await waitForElement<HTMLElement>(
    () => findChatInput(),
    10_000,
    'Could not find Grok chat input. Make sure you are logged into grok.com.'
  );
  console.log('[Seer Grok] Chat input found');

  // Let ProseMirror fully initialize before interacting
  await sleep(500);

  // Count responses before sending
  const beforeCount = document.querySelectorAll(SELECTORS.responseContainer).length;
  console.log(`[Seer Grok] Current response count: ${beforeCount}`);

  // Clear and focus input
  input.innerHTML = '';
  input.focus();
  await sleep(100);

  // Type prompt via clipboard paste
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', prompt);
  input.dispatchEvent(new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  }));

  // Check if paste worked
  await sleep(200);
  const pastedLen = input.innerText.trim().length;
  console.log(`[Seer Grok] After paste: ${pastedLen} chars in input (expected ~${prompt.length})`);

  if (pastedLen < prompt.length * 0.5) {
    // Paste failed or was heavily truncated — try innerText fallback
    console.log('[Seer Grok] Paste truncated — using innerText fallback');
    input.innerText = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    const fallbackLen = input.innerText.trim().length;
    console.log(`[Seer Grok] After innerText fallback: ${fallbackLen} chars`);
  }

  await sleep(300);

  // Click send
  const sendBtn = document.querySelector(SELECTORS.sendButton) as HTMLButtonElement | null;
  if (!sendBtn) {
    throw new Error('Could not find Grok send button.');
  }
  sendBtn.click();
  console.log('[Seer Grok] Prompt sent, waiting for response...');

  // Phase 1: Wait for new response container (MutationObserver)
  const container = await waitForNewContainer(beforeCount);
  console.log('[Seer Grok] New response container detected');

  // Phase 2: Wait for streaming to complete — check GLOBALLY on document.body
  // (.animate-gaussian may be a sibling of .response-content-markdown, not a child)
  console.log('[Seer Grok] Waiting for streaming to complete...');
  await waitForStreamingEnd();
  console.log('[Seer Grok] Streaming indicator gone');

  // Final settle — Grok re-renders after streaming ends
  await sleep(500);

  // Extract text with retry (DOM may still be settling)
  let text = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    // Re-query the container in case DOM was rebuilt
    const allContainers = document.querySelectorAll(SELECTORS.responseContainer);
    const latest = allContainers[allContainers.length - 1];
    if (!latest) {
      console.log(`[Seer Grok] Extract attempt ${attempt + 1}: no container found`);
      await sleep(500);
      continue;
    }

    const clone = latest.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(SELECTORS.cleanTextRemove).forEach(el => el.remove());
    text = clone.innerText?.trim() || '';
    console.log(`[Seer Grok] Extract attempt ${attempt + 1}: ${text.length} chars`);

    if (text.length > 0) break;
    await sleep(500);
  }

  if (!text) {
    throw new Error('Grok response was empty after 3 extraction attempts.');
  }

  console.log(`[Seer Grok] Response received: ${text.length} chars`);
  return text;
}

// ─── MutationObserver-based waiters ──────────────────────────────────

/**
 * Wait for a new response container to appear in the DOM.
 */
function waitForNewContainer(beforeCount: number): Promise<Element> {
  return new Promise((resolve, reject) => {
    // Check immediately
    const all = document.querySelectorAll(SELECTORS.responseContainer);
    if (all.length > beforeCount) {
      return resolve(all[all.length - 1]);
    }

    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Grok did not start responding within timeout.'));
    }, MAX_WAIT_MS);

    const observer = new MutationObserver(() => {
      const all = document.querySelectorAll(SELECTORS.responseContainer);
      if (all.length > beforeCount) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(all[all.length - 1]);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Wait for ALL streaming indicators to disappear from the page.
 * Checks document.body globally — .animate-gaussian may live outside
 * the .response-content-markdown container.
 */
function waitForStreamingEnd(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already done?
    if (!document.querySelector(SELECTORS.streamingIndicator)) {
      return resolve();
    }

    const timeout = setTimeout(() => {
      observer.disconnect();
      console.log('[Seer Grok] Streaming timeout — proceeding anyway');
      resolve(); // Don't reject — try to extract whatever we have
    }, MAX_WAIT_MS);

    const observer = new MutationObserver(() => {
      if (!document.querySelector(SELECTORS.streamingIndicator)) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      }
    });

    // Watch the entire document for streaming indicator removal
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function waitForElement<T>(finder: () => T | null, timeoutMs: number, errMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const el = finder();
    if (el) return resolve(el);

    const start = Date.now();
    const interval = setInterval(() => {
      const el = finder();
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(errMsg));
      }
    }, 200);
  });
}

function findChatInput(): HTMLElement | null {
  return (
    document.querySelector(SELECTORS.chatInput) as HTMLElement ||
    document.querySelector(SELECTORS.chatInputFallback) as HTMLElement ||
    document.querySelector('[contenteditable="true"]') as HTMLElement
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
