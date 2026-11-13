import type {
  ApiEnvelope,
  AuditLog,
  BedInventory,
  Doctor,
  DoctorInput,
  Hospital,
  HospitalDetails,
  HospitalPanelSession,
  HospitalSessionInfo,
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
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
    session?: HospitalPanelSession;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.session) {
    headers.set('x-staff-password', options.session.staffPassword);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The server took too long to respond. Your changes have not been confirmed.'
        : 'Could not reach the server. Check your connection and try again.';
    throw new ApiError(message);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      'The server returned an unreadable response.',
      response.status,
    );
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('success' in body) ||
    body.success !== true ||
    !('data' in body)
  ) {
    throw new ApiError(
      'The server response did not match the expected format.',
    );
  }

  return (body as ApiEnvelope<T>).data;
}

export const hospitalApi = {
  validateSession(session: HospitalPanelSession) {
    return request<HospitalSessionInfo>(
      `/hospitals/${encodeURIComponent(session.hospitalId)}/session`,
      {
        method: 'POST',
        session,
      },
    );
  },
  getHospital(hospitalId: string) {
    return request<HospitalDetails>(
      `/hospitals/${encodeURIComponent(hospitalId)}`,
    );
  },
  getBeds(hospitalId: string) {
    return request<BedInventory[]>(
      `/hospitals/${encodeURIComponent(hospitalId)}/beds`,
    );
  },
  updateBeds(
    hospitalId: string,
    bed: Pick<BedInventory, 'category' | 'department'>,
    operation: 'increment' | 'decrement',
    session: HospitalPanelSession,
  ) {
    return request<BedInventory>(
      `/hospitals/${encodeURIComponent(hospitalId)}/beds`,
      {
        method: 'PATCH',
        session,
        body: { ...bed, operation, count: 1 },
      },
    );
  },
  getDoctors(hospitalId: string) {
    return request<Doctor[]>(
      `/doctors?hospitalId=${encodeURIComponent(hospitalId)}`,
    );
  },
  saveDoctor(
    hospitalId: string,
    doctor: DoctorInput,
    session: HospitalPanelSession,
  ) {
    return request<Doctor>(
      `/hospitals/${encodeURIComponent(hospitalId)}/doctors`,
      { method: 'POST', session, body: doctor },
    );
  },
  getAuditLogs(hospitalId: string, session: HospitalPanelSession) {
    return request<AuditLog[]>(
      `/hospitals/${encodeURIComponent(hospitalId)}/audit-logs`,
      { session },
    );
  },
};
