import { supabase } from './supabase';

const accountKey = 'scamreport-last-account';
const returnKey = 'scamreport-return-to';
const gatePaths = ['/sign-in', '/session-expired', '/unauthorized'];

/** True while this tab is ending the session itself, so the auth listener does not redirect twice. */
export const sessionEnd = { expected: false };

/**
 * The last signed-in account is shown on Session Expired and finds that account's saved draft.
 * It is a UX hint only, never an access grant; a deliberate sign-out clears it.
 */
export const lastAccount = {
  get: (): { id: string; email: string } | null => {
    try { return JSON.parse(localStorage.getItem(accountKey) ?? 'null'); } catch { return null; }
  },
  set: (id: string, email: string | undefined) => localStorage.setItem(accountKey, JSON.stringify({ id, email: email ?? '' })),
  clear: () => localStorage.removeItem(accountKey),
};

/** Where to continue after signing in again; only same-app paths are kept. */
export const returnPath = {
  take: () => {
    const path = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    return path?.startsWith('/') && !path.startsWith('//') ? path : null;
  },
  remember: () => {
    const path = window.location.pathname + window.location.search;
    if (!gatePaths.includes(window.location.pathname)) sessionStorage.setItem(returnKey, path);
  },
};

/** Ends the local session after a 401 and opens the matching gate screen. Report drafts stay on the device. */
export async function expireSession(kind: 'expired' | 'invalid') {
  if (sessionEnd.expected) return;
  sessionEnd.expected = true;
  returnPath.remember();
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* local storage is cleared either way */ }
  window.location.replace(kind === 'expired' ? '/session-expired' : '/sign-in');
}
