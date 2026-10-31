import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson, sendError } from './_lib/http.js';
import { getGeminiClient } from './_lib/gemini.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET requests are allowed');
  }

  const aiAvailable = getGeminiClient().isConfigured();
  return sendJson(res, 200, {
    ok: true,
    aiAvailable,
  });
}
