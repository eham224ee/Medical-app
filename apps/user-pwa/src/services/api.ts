import type {
  ApiEnvelope,
  HospitalDetails,
  PublicDoctor,
  PublicHospital,
  TriageResult,
} from '../types';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 9_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The network is taking too long. Showing saved information when available.'
        : 'You appear to be offline. Showing saved information when available.';
    throw new ApiError(message);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      'The server returned an unreadable response.',
      response.status,
    );
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('success' in payload) ||
    payload.success !== true ||
    !('data' in payload)
  ) {
    throw new ApiError('The server response did not match the expected format.');
  }
  return (payload as ApiEnvelope<T>).data;
}

export const publicApi = {
  getHospitals() {
    return request<PublicHospital[]>('/hospitals');
  },
  getHospital(hospitalId: string) {
    return request<HospitalDetails>(
      `/hospitals/${encodeURIComponent(hospitalId)}`,
    );
  },
  getDoctors() {
    return request<PublicDoctor[]>('/doctors?available=true');
  },
  triage(input: { symptoms: string[]; age: number; gender: string }) {
    return request<TriageResult>('/ai/triage', {
      method: 'POST',
      body: input,
    });
  },
};
