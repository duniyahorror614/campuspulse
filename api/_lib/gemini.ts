import { GoogleGenAI } from '@google/genai';

export interface GeminiCallConfig {
  prompt: string;
  systemInstruction: string;
  responseSchema?: Record<string, unknown>;
}

export interface IGeminiClient {
  isConfigured(): boolean;
  generateStructuredJson(config: GeminiCallConfig): Promise<string>;
}

export class GeminiServiceError extends Error {
  public readonly code:
    | 'AI_NOT_CONFIGURED'
    | 'AI_TIMEOUT'
    | 'AI_UNAVAILABLE'
    | 'AI_INVALID_RESPONSE'
    | 'INTERNAL';
  public readonly statusCode: number;

  constructor(
    code: 'AI_NOT_CONFIGURED' | 'AI_TIMEOUT' | 'AI_UNAVAILABLE' | 'AI_INVALID_RESPONSE' | 'INTERNAL',
    message: string,
    statusCode: number
  ) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ProductionGeminiClient implements IGeminiClient {
  private client: GoogleGenAI | null = null;

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
  }

  private getClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.trim().length === 0) {
      throw new GeminiServiceError(
        'AI_NOT_CONFIGURED',
        'AI features are not configured on this server. You can add notices manually.',
        503
      );
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: key.trim() });
    }
    return this.client;
  }

  public async generateStructuredJson(config: GeminiCallConfig): Promise<string> {
    const ai = this.getClient();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const executeOnce = async (): Promise<string> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

      try {
        const response = await ai.models.generateContent({
          model,
          contents: config.prompt,
          config: {
            systemInstruction: config.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: config.responseSchema,
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 0,
            },
            abortSignal: controller.signal,
          },
        });

        const text = response.text;
        if (!text || text.trim().length === 0) {
          throw new GeminiServiceError(
            'AI_INVALID_RESPONSE',
            'The AI response was empty. You can edit the notice manually.',
            502
          );
        }
        return text;
      } catch (err: unknown) {
        if (err instanceof GeminiServiceError) {
          throw err;
        }

        const errObj = err as Record<string, unknown> | null;
        const errMsg = String(errObj?.message || '');
        const status = Number(errObj?.status || errObj?.statusCode || 0);

        if (controller.signal.aborted || errMsg.toLowerCase().includes('timeout') || errMsg.toLowerCase().includes('abort')) {
          throw new GeminiServiceError(
            'AI_TIMEOUT',
            'AI request timed out. Please try again or enter details manually.',
            504
          );
        }

        if (status === 429 || errMsg.includes('429') || errMsg.toLowerCase().includes('rate')) {
          throw new GeminiServiceError(
            'AI_UNAVAILABLE',
            'AI rate limit reached. Please wait a moment before trying again.',
            503
          );
        }

        if (status === 503 || status === 500 || errMsg.includes('503') || errMsg.toLowerCase().includes('unavailable')) {
          throw new GeminiServiceError(
            'AI_UNAVAILABLE',
            'AI service is currently unavailable. Please try again later or enter details manually.',
            503
          );
        }

        throw new GeminiServiceError(
          'AI_INVALID_RESPONSE',
          'The AI response could not be understood. You can edit the notice manually.',
          502
        );
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Retry once on 503 or transient failure
    try {
      return await executeOnce();
    } catch (firstErr) {
      if (
        firstErr instanceof GeminiServiceError &&
        (firstErr.code === 'AI_UNAVAILABLE' || firstErr.statusCode === 503)
      ) {
        await new Promise((res) => setTimeout(res, 1000));
        return await executeOnce();
      }
      throw firstErr;
    }
  }
}

// Active client instance, injectable for tests
let activeClient: IGeminiClient = new ProductionGeminiClient();

export function getGeminiClient(): IGeminiClient {
  return activeClient;
}

export function setGeminiClientForTesting(client: IGeminiClient): void {
  activeClient = client;
}

export function resetGeminiClient(): void {
  activeClient = new ProductionGeminiClient();
}
