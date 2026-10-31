import type { IncomingMessage, ServerResponse } from 'http';

export const MAX_EXTRACT_BODY_SIZE = 20 * 1024; // 20 KB
export const MAX_SUMMARY_BODY_SIZE = 100 * 1024; // 100 KB

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_UNAVAILABLE'
  | 'AI_NOT_CONFIGURED'
  | 'AI_INVALID_RESPONSE'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL';

export interface ApiErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: ErrorCode,
  message: string,
  extraHeaders?: Record<string, string>
): void {
  setSecurityHeaders(res);
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }
  res.statusCode = status;
  const payload: ApiErrorPayload = {
    error: { code, message },
  };
  res.end(JSON.stringify(payload));
}

export interface ReadBodyResult {
  body: string | null;
  error?: { status: number; code: ErrorCode; message: string };
}

/**
 * Reads request body stream enforcing maximum payload byte length.
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxSizeBytes: number
): Promise<ReadBodyResult> {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      body: null,
      error: {
        status: 400,
        code: 'INVALID_REQUEST',
        message: 'Content-Type must be application/json',
      },
    };
  }

  // Check content-length header if provided
  const contentLength = Number(req.headers['content-length']);
  if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
    return {
      body: null,
      error: {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `Payload exceeds limit of ${maxSizeBytes} bytes`,
      },
    };
  }

  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSizeBytes) {
        req.destroy();
        resolve({
          body: null,
          error: {
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
            message: `Payload exceeds limit of ${maxSizeBytes} bytes`,
          },
        });
      } else {
        chunks.push(chunk);
      }
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve({ body: raw });
    });

    req.on('error', () => {
      resolve({
        body: null,
        error: {
          status: 400,
          code: 'INVALID_REQUEST',
          message: 'Malformed request stream',
        },
      });
    });
  });
}

/**
 * Resolves client IP address from headers safely.
 */
export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}
