import type {
  AdminAuditLog,
  AdminHospital,
  ApiEnvelope,
  PlatformAnalytics,
  VerificationStatus,
} from '../types';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
).replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 8_000;

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
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
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
        ? 'The server took too long to respond.'
        : 'Could not reach the server. Check your connection.';
    throw new ApiError(message);
  }

  if (response.status === 204) return undefined as T;
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

export const adminApi = {
  getSession() {
    return request<{ username: string }>('/admin/session');
  },
  login(username: string, password: string) {
    return request<{ username: string }>('/admin/session', {
      method: 'POST',
      body: { username, password },
    });
  },
  logout() {
    return request<void>('/admin/session', { method: 'DELETE' });
  },
  getPendingHospitals() {
    return request<AdminHospital[]>('/admin/hospitals');
  },
  setVerification(
    hospitalId: string,
    status: Extract<VerificationStatus, 'VERIFIED' | 'REJECTED'>,
  ) {
    return request<Pick<AdminHospital, 'id' | 'verificationStatus'>>(
      `/admin/hospitals/${encodeURIComponent(hospitalId)}/verification`,
      {
        method: 'PATCH',
        body: { status },
      },
    );
  },
  getAuditLogs() {
    return request<AdminAuditLog[]>('/admin/audit-logs?limit=50');
  },
  getAnalytics() {
    return request<PlatformAnalytics>('/admin/analytics');
  },
  getDocumentUrl(hospitalId: string, documentId: string) {
    return request<{ url: string }>(
      `/admin/hospitals/${encodeURIComponent(hospitalId)}/documents/${encodeURIComponent(documentId)}/url`,
    );
  },
};
