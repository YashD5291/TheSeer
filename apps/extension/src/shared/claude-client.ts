/**
 * The Seer — Claude client via chrome.scripting.executeScript.
 * Opens claude.ai project chat, pastes the prompt, clicks send.
 * Same pattern as grok-client.ts: fire-and-forget automation with message callback.
 */

const CLAUDE_PROJECT_URL = 'https://claude.ai/project/019af037-9894-7058-8e80-376f028729c2';

/**
 * Open a new Claude chat in the project, paste the prompt, and submit it.
 * Resolves with the Claude tab ID when the prompt has been submitted.
 */
export async function submitPromptToClaude(
  prompt: string,
  preferredModel?: string,
  extendedThinking?: boolean,
): Promise<number> {
  console.log(`[Seer Claude] Opening Claude project chat...`);
  const tab = await chrome.tabs.create({ url: CLAUDE_PROJECT_URL, active: false });
  const tabId = tab.id!;
  await waitForTabLoad(tabId);
  console.log(`[Seer Claude] Tab loaded (${tabId}), injecting automation...`);

  const modelToUse = preferredModel || 'Sonnet 4.5';
  const wantThinking = extendedThinking === true;
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
    args: [prompt, requestId, modelToUse, wantThinking],
  });
  console.log(`[Seer Claude] Automation injected (requestId: ${requestId}, model: ${modelToUse}, thinking: ${wantThinking}), waiting for submit...`);

  await resultPromise;
  console.log(`[Seer Claude] Prompt submitted successfully (tab: ${tabId})`);
  return tabId;
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
function claudeAutomation(prompt: string, requestId: string, preferredModel: string, wantThinking: boolean): void {
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

      // ── Step 2: Select Sonnet 4.5 and disable extended thinking ──
      console.log('[Seer Claude] Step 2: Configuring model...');
      const modelBtn = document.querySelector('button[data-testid="model-selector-dropdown"]') as HTMLButtonElement;
      if (modelBtn) {
        const btnText = modelBtn.textContent || '';
        const isPreferred = btnText.includes(preferredModel);
        const hasExtended = btnText.includes('Extended');
        const needsThinkingToggle = hasExtended !== wantThinking;

        if (!isPreferred || needsThinkingToggle) {
          // Open model menu
          modelBtn.click();
          await sleep(500);

          // Toggle extended thinking if it doesn't match preference
          if (needsThinkingToggle) {
            const allItems = document.querySelectorAll('[role="menuitem"]');
            for (const item of allItems) {
              if (item.textContent?.includes('Extended thinking')) {
                const toggle = item.querySelector('input[role="switch"]') as HTMLInputElement;
                if (toggle && toggle.checked !== wantThinking) {
                  console.log(`[Seer Claude] ${wantThinking ? 'Enabling' : 'Disabling'} extended thinking...`);
                  (item as HTMLElement).click();
                  await sleep(400);
                }
                break;
              }
            }
          }

          // Select preferred model if needed
          if (!isPreferred) {
            // First check if preferred model is in the main menu
            let found = false;
            const mainItems = document.querySelectorAll('[role="menuitem"]');
            for (const item of mainItems) {
              const label = item.querySelector('.font-ui');
              if (label?.textContent?.trim() === preferredModel) {
                console.log(`[Seer Claude] Found ${preferredModel} in main menu, clicking...`);
                (item as HTMLElement).click();
                found = true;
                break;
              }
            }

            // If not in main menu, expand "More models" submenu
            if (!found) {
              let moreBtn: HTMLElement | null = null;
              const items2 = document.querySelectorAll('[role="menuitem"]');
              for (const item of items2) {
                if (item.textContent?.includes('More models')) {
                  moreBtn = item as HTMLElement;
                  break;
                }
              }

              if (moreBtn) {
                console.log('[Seer Claude] Opening "More models" submenu...');
                // Hover to expand the submenu
                moreBtn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
                moreBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await sleep(600);

                // Click if submenu didn't open via hover
                if (moreBtn.getAttribute('aria-expanded') !== 'true') {
                  moreBtn.click();
                  await sleep(500);
                }

                // Find preferred model in submenu
                const subItems = document.querySelectorAll('[role="menuitem"]');
                for (const item of subItems) {
                  const label = item.querySelector('.font-ui');
                  if (label?.textContent?.trim() === preferredModel) {
                    console.log(`[Seer Claude] Found ${preferredModel} in submenu, clicking...`);
                    (item as HTMLElement).click();
                    found = true;
                    break;
                  }
                }
              }
            }

            if (!found) {
              console.log(`[Seer Claude] ${preferredModel} not found in menu — closing`);
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
          } else {
            // Model was already correct, just needed to toggle thinking — close menu
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          }

          await sleep(500); // Let model switch settle
        } else {
          console.log(`[Seer Claude] Already on ${preferredModel} (thinking: ${wantThinking ? 'on' : 'off'}) — no changes needed`);
        }
      } else {
        console.log('[Seer Claude] Model selector not found — skipping');
      }

      // ── Step 3: Paste prompt ──
      console.log('[Seer Claude] Step 3: Pasting prompt...');
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

      // ── Step 4: Find and click send button ──
      console.log('[Seer Claude] Step 4: Looking for send button...');
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
