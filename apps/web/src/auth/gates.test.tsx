import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@scamreport/shared';
import { IdentityProvider, useIdentity } from './identity';
import { SessionExpired, SignIn } from './gates';
import { lastAccount, returnPath } from '@/lib/session';

const auth = vi.hoisted<{ initiallySignedIn: boolean; listener?: (event: string, session: unknown) => void }>(() => ({ initiallySignedIn: false }));
const me: Me = { id: 'user-1', email: 'citizen@demo.example.test', role: 'citizen', memberships: [] };
const session = () => ({ user: { id: me.id }, access_token: 'local-test-token' });
vi.mock('@/lib/supabase', () => ({
  sessionWasStored: false,
  supabase: { auth: {
    getSession: vi.fn(async () => ({ data: { session: auth.initiallySignedIn ? session() : null }, error: null })),
    onAuthStateChange: vi.fn((listener: (event: string, session: unknown) => void) => {
      auth.listener = listener;
      return { data: { subscription: { unsubscribe() {} } } };
    }),
    signInWithPassword: vi.fn(async () => { auth.listener?.('SIGNED_IN', session()); return { error: null }; }),
    signOut: vi.fn(async () => ({ error: null })),
  } },
}));
vi.mock('@/lib/api', () => ({ api: vi.fn(async () => me) }));
vi.mock('@/lib/draft', () => ({ drafts: { load: vi.fn(async () => ({ description: 'A saved report' })) } }));

function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname + location.search}</p>;
}
function BeforeGate() {
  const { me, pending } = useIdentity();
  return !pending && me ? <Link to="/sign-in">Open signed-in gate</Link> : null;
}
function mount(initialEntry = '/sign-in') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IdentityProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Link to="/session-expired">Open expired gate</Link>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/session-expired" element={<SessionExpired />} />
            <Route path="/ready" element={<BeforeGate />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
    { reactStrictMode: true },
  );
}
function remember(path: string) {
  window.history.replaceState(null, '', path);
  returnPath.remember();
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.initiallySignedIn = false;
  sessionStorage.clear();
  lastAccount.set(me.id, me.email);
});
afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('authenticated gate return path', () => {
  test.each([
    ['/citizen/report?step=consent', '/citizen/report?step=consent'],
    ['/admin/members', '/citizen/feed'],
  ])('a transient signed-out gate preserves %s until expired-session login, restricted to %s', async (target, expected) => {
    remember(target);
    mount();
    await screen.findByRole('textbox', { name: 'อีเมล' });
    fireEvent.click(screen.getByRole('link', { name: 'Open expired gate' }));
    await screen.findByRole('heading', { name: /ออกจากระบบแล้ว/ });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'Demo-only-234!' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบอีกครั้ง' }));
    expect((await screen.findByTestId('destination')).textContent).toBe(expected);
  });
  test('an already authenticated gate consumes its destination once under StrictMode', async () => {
    auth.initiallySignedIn = true;
    remember('/citizen/report?step=consent');
    mount('/ready');
    fireEvent.click(await screen.findByRole('link', { name: 'Open signed-in gate' }));
    expect((await screen.findByTestId('destination')).textContent).toBe('/citizen/report?step=consent');
  });
});
