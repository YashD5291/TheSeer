/**
 * MAIN world content script for claude.ai — runs at document_start.
 * Intercepts window.fetch BEFORE Claude's JS loads. For streaming POST
 * responses (SSE), wraps the body stream to capture data as Claude's own
 * code reads it. When the stream ends (or aborts), we extract Claude's
 * text response and signal the ISOLATED world content script.
 *
 * Key: instead of response.clone().text() (which dies on AbortController
 * abort), we wrap the ReadableStream body. Chunks are captured as they
 * flow through, so even if the stream is aborted mid-flight, we keep
 * everything received up to that point.
 */

const origFetch = window.fetch;

(window as any).fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await origFetch.call(this, input, init);

  const method = (
    init?.method || (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  const contentType = response.headers.get('content-type') || '';

  // Only intercept streaming POST responses (Claude's completion API)
  if (
    method === 'POST' &&
    contentType.includes('text/event-stream') &&
    response.body
  ) {
    const originalBody = response.body;
    const chunks: Uint8Array[] = [];

    // Wrap the body: Claude's code reads from this transparently,
    // while we capture every chunk as it passes through.
    const wrappedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = originalBody.getReader();

        function pump(): void {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                processCapture(chunks, true);
                return;
              }
              chunks.push(value);
              controller.enqueue(value);
              pump();
            })
            .catch((err) => {
              // Stream aborted — still process what we captured
              processCapture(chunks, false);
              try {
                controller.error(err);
              } catch {
                /* already errored */
              }
            });
        }

        pump();
      },
    });

    // Return a Response with our wrapped body — transparent to Claude
    return new Response(wrappedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
};

/** Decode captured chunks, parse SSE, extract text, signal completion. */
function processCapture(chunks: Uint8Array[], natural: boolean) {
  if (chunks.length === 0) return;

  const decoder = new TextDecoder();
  let body = '';
  for (const chunk of chunks) {
    body += decoder.decode(chunk, { stream: true });
  }
  body += decoder.decode(); // flush

  // Parse SSE events to extract Claude's text deltas
  let fullText = '';
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const data = JSON.parse(line.slice(6));
      if (
        data.type === 'content_block_delta' &&
        data.delta?.type === 'text_delta'
      ) {
        fullText += data.delta.text;
      }
    } catch {
      /* not JSON — e.g. "data: [DONE]" */
    }
  }

  // Natural end → always signal; abort → only if substantial content
  // (short aborts are typically navigation away, not real responses)
  if (fullText.length > 0 && (natural || fullText.length > 500)) {
    console.log(
      `[Seer Hook] Claude response captured (${fullText.length} chars, ${natural ? 'stream ended' : 'aborted with data'})`,
    );
    window.postMessage(
      {
        type: '__seer_claude_response_complete__',
        chatUrl: window.location.href,
        responseText: fullText,
      },
      '*',
    );
  } else if (fullText.length > 0) {
    console.log(
      `[Seer Hook] Partial capture (${fullText.length} chars, aborted) — likely navigation, skipping`,
    );
  }
}
