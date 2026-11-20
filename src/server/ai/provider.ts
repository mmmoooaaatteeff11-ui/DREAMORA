import 'server-only';

/**
 * Provider-agnostic chat wrapper. The rest of the app only calls streamChat(); swapping Gemini for
 * another provider means rewriting THIS file only. The API key never leaves the server.
 *
 * Env: LLM_API_KEY (required), LLM_MODEL (optional; see DEFAULT_MODEL).
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type AiErrorCode = 'not_configured' | 'upstream' | 'provider_rate_limited' | 'blocked';

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? code);
    this.name = 'AiProviderError';
  }
}

// Check https://ai.google.dev/gemini-api/docs/models for current model names and set LLM_MODEL to change.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiChunk = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function* streamChat(opts: {
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new AiProviderError('not_configured');

  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const url = `${ENDPOINT}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        // Headroom: some models spend part of this budget on internal reasoning.
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
      }),
      signal: opts.signal,
    });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    throw new AiProviderError('upstream', 'network');
  }

  if (!response.ok || !response.body) {
    // Log the status only: never log prompts, replies or keys.
    const code = response.status === 429 ? 'provider_rate_limited' : 'upstream';
    throw new AiProviderError(code, `status ${response.status}`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parse = (line: string): { text: string; blocked: boolean } => {
    if (!line.startsWith('data:')) return { text: '', blocked: false };
    let chunk: GeminiChunk;
    try {
      chunk = JSON.parse(line.slice(5).trim());
    } catch {
      return { text: '', blocked: false };
    }
    if (chunk.promptFeedback?.blockReason) return { text: '', blocked: true };
    const candidate = chunk.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('');
    const blocked = candidate?.finishReason === 'SAFETY' && text === '';
    return { text, blocked };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const { text, blocked } = parse(line);
      if (blocked) throw new AiProviderError('blocked');
      if (text) yield text;
    }
  }

  // Flush a final line that had no trailing newline.
  const tail = parse(buffer);
  if (tail.blocked) throw new AiProviderError('blocked');
  if (tail.text) yield tail.text;
}
