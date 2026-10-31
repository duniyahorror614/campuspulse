import type {
  DraftNotice,
  ExtractResponse,
  SummaryResponse,
  HealthResponse,
  CompactNotice,
} from '../../shared/schema.js';

export interface ApiClientResult<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { ok: false, aiAvailable: false };
    }
    return (await res.json()) as HealthResponse;
  } catch {
    return { ok: false, aiAvailable: false };
  }
}

export async function requestExtractNotices(
  text: string,
  referenceDate: string,
  timezone: string
): Promise<ApiClientResult<DraftNotice[]>> {
  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, referenceDate, timezone }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        code: data?.error?.code || 'UNKNOWN_ERROR',
        message: data?.error?.message || 'Failed to extract notice with AI.',
      };
    }

    const typedData = data as ExtractResponse;
    return {
      success: true,
      data: typedData.notices,
    };
  } catch {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Could not connect to the server. Please check your connection.',
    };
  }
}

export async function requestWeeklySummary(
  referenceDate: string,
  timezone: string,
  notices: CompactNotice[]
): Promise<ApiClientResult<SummaryResponse>> {
  try {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceDate, timezone, notices }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        code: data?.error?.code || 'UNKNOWN_ERROR',
        message: data?.error?.message || 'Failed to generate weekly summary.',
      };
    }

    const typedData = data as SummaryResponse;
    return {
      success: true,
      data: typedData,
    };
  } catch {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Network error connecting to summary service.',
    };
  }
}
