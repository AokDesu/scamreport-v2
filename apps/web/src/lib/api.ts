import type { ApiError, ErrorCode } from '@scamreport/shared';
import { supabase } from './supabase';
import { expireSession } from './session';

/** A failed API call. Screens show translated text for `code`; `requestId` is the support reference. */
export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, readonly requestId: string) {
    super(`${status} ${code}`);
  }
}

/**
 * Calls the Elysia API with the caller's own Supabase JWT. A 401 ends the local session and moves to
 * Session Expired (or Sign in for an invalid token) while drafts stay in device storage. A 403 is
 * returned as an ApiFailure so the screen can explain the role held and the role needed in place.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestId = crypto.randomUUID();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    if (error.status && error.status < 500) await expireSession('expired');
    throw new ApiFailure(0, 'INTERNAL_ERROR', requestId);
  }
  const headers = new Headers(init.headers);
  headers.set('X-Request-Id', requestId);
  if (session) headers.set('Authorization', 'Bearer ' + session.access_token);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch('/api' + path, { ...init, headers });
  } catch {
    throw new ApiFailure(0, 'INTERNAL_ERROR', requestId);
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as ApiError | null;
    const code = failure?.error.code ?? 'INTERNAL_ERROR';
    const reference = failure?.error.requestId ?? response.headers.get('x-request-id') ?? requestId;
    if (response.status === 401) await expireSession(code === 'SESSION_EXPIRED' ? 'expired' : 'invalid');
    throw new ApiFailure(response.status, code, reference);
  }
  if (init.method === 'GET' || !init.method) {
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return await response.blob() as T;
  }
  const body: { data: T } = await response.json();
  return body.data;
}

/** Translation key for a failure that a screen shows inline (403/404 have dedicated screens). */
export function failureMessageKey(error: unknown) {
  if (!(error instanceof ApiFailure) || error.status === 0) return 'errors.network';
  if (error.code === 'VALIDATION_FAILED') return 'errors.validation';
  if (error.code === 'CONFLICT') return 'errors.conflict';
  return 'errors.generic';
}
