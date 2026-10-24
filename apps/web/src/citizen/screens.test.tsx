import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Report } from '@scamreport/shared';
import i18n from '@/i18n';
import { ApiFailure } from '@/lib/api';
import { Feed, Submitted } from './screens';

const network = vi.hoisted(() => ({ reply: (_path: string): unknown => [] }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} }, sessionWasStored: false }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: vi.fn(async (path: string) => network.reply(path)) }));
vi.mock('@/auth/identity', () => ({ useIdentity: () => ({ signOut: async () => true }) }));

const report: Report = { id: 'old-owned', ticket_no: 4801, reporter_id: 'owner', organization_id: 'A', scam_type: 'shopping', channel: 'sms', amount: 50, description: 'old owned report', consent_contact: false, status: 'pending', created_at: '2025-01-01T00:00:00Z' };
beforeEach(async () => { await i18n.changeLanguage('en'); network.reply = () => []; });
function mount(path: string, child: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/received/:id" element={child} /><Route path="/feed" element={child} /></Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

test('received tickets load by scoped ID regardless of the newest list window', async () => {
  const paths: string[] = [];
  network.reply = path => { paths.push(path); return path === '/reports/old-owned' ? report : []; };
  mount('/received/old-owned', <Submitted />);
  expect(await screen.findByRole('heading', { name: /Online shopping/ })).toBeTruthy();
  expect(paths).toContain('/reports/old-owned');
  expect(paths.some(path => path.startsWith('/reports?'))).toBe(false);
});

test('a missing received ticket finishes with an error and navigation', async () => {
  network.reply = path => { if (path.startsWith('/reports/')) throw new ApiFailure(404, 'NOT_FOUND', 'missing'); return []; };
  mount('/received/foreign', <Submitted />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'See my reports' })).toBeTruthy();
  expect(screen.queryByRole('status', { name: 'Loading…' })).toBeNull();
});

test('a malformed received ticket ID finishes as not found without a retry that cannot succeed', async () => {
  network.reply = path => { if (path.startsWith('/reports/')) throw new ApiFailure(422, 'VALIDATION_FAILED', 'invalid'); return []; };
  mount('/received/abc', <Submitted />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'See my reports' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});

test('changing feed criteria hides earlier warnings until matching results arrive', async () => {
  let finish!: (value: unknown[]) => void;
  network.reply = path => path === '/feed?limit=50' ? [{ ...report, status: 'verified' }] : new Promise(resolve => { finish = resolve; });
  mount('/feed', <Feed />);
  expect(await screen.findByRole('heading', { name: 'Online shopping / fake parcel' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search scams' }), { target: { value: 'investment' } });
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Online shopping / fake parcel' })).toBeNull());
  expect(screen.queryByText('1 match')).toBeNull();
  finish([]);
  expect(await screen.findByText('No verified warning matches yet')).toBeTruthy();
});
