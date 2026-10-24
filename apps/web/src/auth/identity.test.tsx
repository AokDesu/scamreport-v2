import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@scamreport/shared';
import { IdentityProvider, useIdentity } from './identity';
import { drafts } from '@/lib/draft';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import i18n from '@/i18n';

type Listener = (event: string, session: unknown) => void;
const auth = vi.hoisted(() => ({ listener: undefined as undefined | ((event: string, session: unknown) => void) }));
const session = (id: string) => ({ user: { id }, access_token: `token-${id}` });

vi.mock('@/lib/supabase', () => ({
  sessionWasStored: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: session('user-1') }, error: null })),
      onAuthStateChange: vi.fn((listener: Listener) => { auth.listener = listener; return { data: { subscription: { unsubscribe() {} } } }; }),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));
vi.mock('@/lib/api', () => ({ api: vi.fn(async () => ({ id: 'user-1', email: 'a@example.test', role: 'citizen', memberships: [] } satisfies Me)) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/draft', () => ({ drafts: { remove: vi.fn(async () => undefined) } }));
vi.mock('@/lib/session', () => ({
  expireSession: vi.fn(), sessionEnd: { expected: false }, lastAccount: { set: () => {}, clear: () => {}, get: () => null },
}));

function SignOut() {
  const { signOut } = useIdentity();
  return <button onClick={() => void signOut()}>Leave</button>;
}

async function mount() {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><IdentityProvider><SignOut /></IdentityProvider></QueryClientProvider>);
  await waitFor(() => expect(client.getQueryData(['me', 'user-1'])).toBeTruthy());
  client.setQueryData(['queue', 'tab'], ['kept?']);
  return client;
}

describe('identity cache', () => {
  test('a tab regaining focus re-confirms the same user without clearing the cache', async () => {
    const client = await mount();
    act(() => auth.listener!('SIGNED_IN', session('user-1')));
    expect(client.getQueryData(['queue', 'tab'])).toEqual(['kept?']);
    expect(client.getQueryData(['me', 'user-1'])).toBeTruthy();
  });
  test('signing in as a different user clears every cached answer', async () => {
    const client = await mount();
    act(() => auth.listener!('SIGNED_IN', session('user-2')));
    expect(client.getQueryData(['queue', 'tab'])).toBeUndefined();
  });
  test('signing out clears the cache', async () => {
    const client = await mount();
    act(() => auth.listener!('SIGNED_OUT', null));
    expect(client.getQueryData(['queue', 'tab'])).toBeUndefined();
  });
  test('sign-out completes when draft removal fails, with a notice for a citizen', async () => {
    await mount();
    vi.mocked(drafts.remove).mockRejectedValueOnce(new Error('storage unavailable'));
    vi.mocked(supabase.auth.signOut).mockClear();
    vi.mocked(toast.error).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(toast.error).toHaveBeenCalledWith(i18n.t('errors.draftRemains'));
  });
  test('sign-out completes for staff without any draft notice', async () => {
    vi.mocked(api).mockResolvedValueOnce({ id: 'user-1', email: 'a@example.test', role: 'staff', memberships: [{ organization_id: 'org', role: 'moderator' }] } as unknown as Me);
    await mount();
    vi.mocked(drafts.remove).mockRejectedValueOnce(new Error('storage unavailable'));
    vi.mocked(supabase.auth.signOut).mockClear();
    vi.mocked(toast.error).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
