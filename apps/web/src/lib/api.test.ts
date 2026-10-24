import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, ApiFailure, failureMessageKey } from './api';
import { expireSession } from './session';

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-1' } }, error: null })) } },
  sessionWasStored: true,
}));
vi.mock('./session', () => ({ expireSession: vi.fn(async () => {}) }));

function respond(status: number, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers })));
}
const failure = (code: string, requestId = 'req-1') => ({ error: { code, message: 'Raw server text that must not reach the screen.', requestId } });

beforeEach(() => vi.mocked(expireSession).mockClear());
afterEach(() => vi.unstubAllGlobals());

describe('API status handling', () => {
  test('success returns the data envelope and sends the caller JWT with a request ID', async () => {
    respond(200, { data: { ok: true } });
    expect(await api<{ ok: boolean }>('/me')).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/me');
    const headers = new Headers(init!.headers);
    expect(headers.get('authorization')).toBe('Bearer token-1');
    expect(headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('401 SESSION_EXPIRED ends the session as expired (Session Expired screen)', async () => {
    respond(401, failure('SESSION_EXPIRED'));
    await expect(api('/reports')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(expireSession).toHaveBeenCalledWith('expired');
  });

  test('401 UNAUTHENTICATED is an invalid session (back to Sign in), not "expired"', async () => {
    respond(401, failure('UNAUTHENTICATED'));
    await expect(api('/reports')).rejects.toBeInstanceOf(ApiFailure);
    expect(expireSession).toHaveBeenCalledWith('invalid');
  });

  test('403 keeps the session and hands the screen the request ID for the Unauthorized view', async () => {
    respond(403, failure('FORBIDDEN', 'req-403'));
    const error = await api('/moderation/queue?organization_id=x').catch(caught => caught);
    expect(error).toBeInstanceOf(ApiFailure);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', requestId: 'req-403' });
    expect(expireSession).not.toHaveBeenCalled();
  });

  test('404 from a foreign row stays a not-found, never a sign-out', async () => {
    respond(404, failure('NOT_FOUND'));
    await expect(api('/moderation/abc')).rejects.toMatchObject({ status: 404 });
    expect(expireSession).not.toHaveBeenCalled();
  });

  test('a dropped connection is a retryable network failure, never a session expiry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const error = await api('/feed').catch(caught => caught);
    expect(error).toMatchObject({ status: 0 });
    expect(failureMessageKey(error)).toBe('errors.network');
    expect(expireSession).not.toHaveBeenCalled();
  });

  test('an upstream page without the JSON envelope still yields a coded failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502, headers: { 'x-request-id': 'proxy-1' } })));
    await expect(api('/feed')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR', requestId: 'proxy-1' });
  });

  test('screens map failures to translation keys, never to the server message', () => {
    expect(failureMessageKey(new ApiFailure(422, 'VALIDATION_FAILED', 'r'))).toBe('errors.validation');
    expect(failureMessageKey(new ApiFailure(409, 'CONFLICT', 'r'))).toBe('errors.conflict');
    expect(failureMessageKey(new ApiFailure(500, 'INTERNAL_ERROR', 'r'))).toBe('errors.generic');
    expect(failureMessageKey(new Error('Raw server text'))).toBe('errors.network');
  });
});
