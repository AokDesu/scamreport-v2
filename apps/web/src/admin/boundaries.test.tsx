import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuditEntry, Me, Membership, Report, Tenant } from '@scamreport/shared';
import i18n from '@/i18n';
import { homePath } from '@/lib/domain';
import { ConsoleLayout, useConsole } from './shell';
import AdminConsole from './console';
import { QueuePage } from './queue';
import { DetailPage } from './detail';
import { ActivityPage } from './activity';
import { DashboardPage } from './dashboard';
import { MembersPage } from './members';

const network = vi.hoisted(() => ({ reply: (_path: string, _init?: RequestInit): unknown => [] }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} }, sessionWasStored: false }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: vi.fn(async (path: string, init?: RequestInit) => network.reply(path, init)) }));
vi.mock('@/auth/identity', () => ({ useIdentity: () => ({ signOut: async () => true }) }));

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tenants: Tenant[] = [{ id: A, name: 'Demo A' }, { id: B, name: 'Demo B' }];
const membership = (org: string, role: Membership['role']): Membership => ({ organization_id: org, user_id: 'staff', role });
const identity = (memberships = [membership(A, 'org_admin')]): Me => ({ id: 'staff', email: 'staff@demo.example.test', role: 'staff', memberships });
const report: Report = { id: 'report-A', ticket_no: 4801, reporter_id: 'citizen', organization_id: A, scam_type: 'shopping', channel: 'sms', amount: 20, description: 'fictional case A', status: 'pending', consent_contact: true, created_at: '2026-10-24T07:00:00Z' };
const audit: AuditEntry = { id: 'audit-A', actor_id: 'removed-staff', organization_id: A, action: 'reports.update', resource_id: report.id, request_id: 'request-A', created_at: report.created_at, ticket_no: null, report_created_at: null, is_moderation: true };
function normal(path: string): unknown {
  if (path === '/tenants') return tenants;
  if (path.includes('/counts')) return path.startsWith('/audit') ? { total: 1, denied: 0 } : { pending: 0, flagged: 0, decided: 0 };
  if (path.startsWith('/moderation/next')) return null;
  if (path === `/moderation/${report.id}`) return { report, history: [] };
  return [];
}
beforeEach(async () => { await i18n.changeLanguage('en'); network.reply = normal; });
function mount(page: React.ReactNode, path = '/admin/queue', me = identity()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route element={<ConsoleLayout me={me} />}><Route path="/admin/queue" element={page} /><Route path="/admin/reports/:id" element={page} /><Route path="/admin/activity" element={page} /><Route path="/admin/dashboard" element={page} /><Route path="/admin/members" element={page} /></Route></Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

test('a failed next read is retryable and never claims the queue is empty', async () => {
  let failed = true;
  network.reply = path => { if (path.startsWith('/moderation/next') && failed) throw new Error('offline'); return normal(path); };
  mount(<QueuePage />);
  const error = await screen.findByRole('alert');
  expect(screen.queryByText('No reports waiting')).toBeNull();
  expect(screen.getByRole('button', { name: 'Call next' }).hasAttribute('disabled')).toBe(true);
  failed = false;
  fireEvent.click(within(error).getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No reports waiting')).toBeTruthy();
});

test.each(['list', 'download'])('failed evidence %s shows a retry instead of an empty claim or endless skeleton', async failure => {
  network.reply = path => {
    if (path === `/reports/${report.id}/evidence`) {
      if (failure === 'list') throw new Error('offline');
      return [{ path: `${report.id}/file.pdf` }];
    }
    if (path.endsWith('/evidence/file.pdf')) throw new Error('offline');
    return normal(path);
  };
  mount(<DetailPage />, `/admin/reports/${report.id}`);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText(i18n.t('detail.noEvidence'))).toBeNull();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

test('a saved decision remains saved when next lookup fails and retry only repeats the lookup', async () => {
  let saved = false;
  let nextFails = true;
  let writes = 0;
  network.reply = (path, init) => {
    if (path === `/moderation/${report.id}`) {
      if (init?.method === 'POST') { saved = true; writes++; }
      return init?.method === 'POST' ? { ...report, status: 'verified' } : { report: { ...report, status: saved ? 'verified' : 'pending' }, history: [] };
    }
    if (path.startsWith('/moderation/next') && nextFails) throw new Error('offline');
    return normal(path);
  };
  mount(<DetailPage />, `/admin/reports/${report.id}`, identity([membership(A, 'moderator')]));
  fireEvent.click(await screen.findByRole('radio', { name: i18n.t('detail.verify') }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('detail.saveAndNext') }));
  const error = await screen.findByRole('alert');
  expect(writes).toBe(1);
  nextFails = false;
  fireEvent.click(within(error).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(writes).toBe(1);
});

test('failed dashboard breakdown exposes unavailable data instead of zero charts', async () => {
  network.reply = path => {
    if (path.startsWith('/statistics/breakdown')) throw new Error('offline');
    if (path.startsWith('/statistics?')) return [{ status: 'pending', report_count: 1, total_amount: 20 }];
    return normal(path);
  };
  mount(<DashboardPage />, '/admin/dashboard', identity([membership(A, 'executive')]));
  await screen.findAllByRole('alert');
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByRole('img', { name: /^Reports received per week/ })).toBeNull();
  expect(within(screen.getByRole('region', { name: i18n.t('dashboard.byType') })).queryByRole('definition')).toBeNull();
});

test('failed capability lookup is retryable instead of an empty matrix', async () => {
  network.reply = path => { if (path === '/roles') throw new Error('offline'); return normal(path); };
  mount(<MembersPage />, '/admin/members');
  const matrix = screen.getByRole('region', { name: i18n.t('members.matrix') });
  expect(await within(matrix).findByRole('alert')).toBeTruthy();
  expect(within(matrix).queryByRole('table')).toBeNull();
});

test('removed moderation actors remain staff even when the ticket is hidden', async () => {
  network.reply = path => path.startsWith('/audit?') ? [audit] : normal(path);
  mount(<ActivityPage />, '/admin/activity');
  expect(await screen.findByText(i18n.t('activity.formerMember'))).toBeTruthy();
  expect(screen.queryByText(i18n.t('activity.reporter'))).toBeNull();
});

test('changing Activity result hides prior rows while the new result is pending', async () => {
  let finish!: (rows: AuditEntry[]) => void;
  network.reply = path => path.startsWith('/audit?') ? path.includes('result=denied') ? new Promise(resolve => { finish = resolve; }) : [audit] : normal(path);
  mount(<ActivityPage />, '/admin/activity');
  expect(await screen.findByText('request-A')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('combobox', { name: i18n.t('activity.resultFilter') }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: i18n.t('activity.denied') }));
  await waitFor(() => expect(screen.queryByText('request-A')).toBeNull());
  finish([]);
  expect(await screen.findByText(i18n.t('activity.emptyFiltered'))).toBeTruthy();
});

test('changing Activity organization hides the previous organization rows', async () => {
  let finish!: (rows: AuditEntry[]) => void;
  network.reply = path => path.startsWith('/audit?') ? path.includes(B) ? new Promise(resolve => { finish = resolve; }) : [audit] : normal(path);
  mount(<ActivityPage />, '/admin/activity', identity([membership(A, 'org_admin'), membership(B, 'org_admin')]));
  expect(await screen.findByText('request-A')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('combobox', { name: i18n.t('admin.switchOrg') }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Demo B' }));
  await waitFor(() => expect(screen.queryByText('request-A')).toBeNull());
  finish([]);
});

test('changing organization returns Activity to its first page', async () => {
  const requested: string[] = [];
  network.reply = path => {
    if (path.startsWith('/audit?')) { requested.push(path); return path.includes(`offset=20`) ? [] : Array.from({ length: 20 }, (_, index) => ({ ...audit, id: `audit-${index}`, request_id: `request-${path.includes(B) ? 'B' : 'A'}-${index}` })); }
    return normal(path);
  };
  mount(<ActivityPage />, '/admin/activity', identity([membership(A, 'org_admin'), membership(B, 'org_admin')]));
  expect(await screen.findByText('request-A-0')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('activity.next')) }));
  await waitFor(() => expect(requested.some(path => path.includes(A) && path.includes('offset=20'))).toBe(true));
  fireEvent.keyDown(screen.getByRole('combobox', { name: i18n.t('admin.switchOrg') }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Demo B' }));
  expect(await screen.findByText('request-B-0')).toBeTruthy();
  expect(requested.some(path => path.includes(B) && path.includes('offset=20'))).toBe(false);
});

test('detail context and decision rights follow its report rather than selected organization', async () => {
  const requested: string[] = [];
  network.reply = path => { requested.push(path); return normal(path); };
  mount(<DetailPage />, `/admin/reports/${report.id}`, identity([membership(B, 'moderator'), membership(A, 'org_admin')]));
  expect(await screen.findByText(report.description)).toBeTruthy();
  expect(screen.getByText(i18n.t('detail.routedValue', { org: 'Demo A' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('detail.consentYes', { org: 'Demo A' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('detail.adminReadOnly'))).toBeTruthy();
  expect(requested).toContain(`/members?organization_id=${A}`);
  expect(screen.queryByRole('button', { name: i18n.t('detail.saveAndNext') })).toBeNull();
});

test('home and initial organization resolve the same mixed-membership role', async () => {
  const me = identity([membership(A, 'executive'), membership(B, 'moderator')]);
  function Context() { const { orgId, home, role } = useConsole(); return <p>{orgId}|{home}|{role}</p>; }
  mount(<Context />, homePath(me), me);
  expect(await screen.findByText(`${B}|/admin/queue|moderator`)).toBeTruthy();
});

test('the console index follows the selected tenant role', async () => {
  const me = identity([membership(A, 'executive'), membership(B, 'moderator')]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin']}><Routes><Route path="/admin/*" element={<AdminConsole me={me} />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByRole('heading', { level: 1, name: i18n.t('admin.queue') });
  fireEvent.keyDown(screen.getByRole('combobox', { name: i18n.t('admin.switchOrg') }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Demo A' }));
  fireEvent.click(screen.getByRole('link', { name: i18n.t('app.name') }));
  expect(await screen.findByRole('heading', { level: 1, name: i18n.t('admin.dashboard') })).toBeTruthy();
});

test('reloading a page picks the organization whose role permits it, with no denied request', async () => {
  const me = identity([membership(A, 'executive'), membership(B, 'moderator')]);
  const requested: string[] = [];
  network.reply = path => { requested.push(path); return normal(path); };
  function Context() { const { orgId, role } = useConsole(); return <p>{orgId}|{role}</p>; }
  mount(<Context />, '/admin/dashboard', me);
  expect(await screen.findByText(`${A}|executive`)).toBeTruthy();
  expect(requested.filter(path => path.includes(B))).toEqual([]);
});

test('a route no membership permits lands on the selected organization home instead of calling the API', async () => {
  const me = identity([membership(A, 'executive')]);
  const requested: string[] = [];
  network.reply = path => { requested.push(path); return normal(path); };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/queue']}><Routes><Route path="/admin/*" element={<AdminConsole me={me} />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('heading', { level: 1, name: i18n.t('admin.dashboard') })).toBeTruthy();
  expect(requested.some(path => path.startsWith('/moderation'))).toBe(false);
});
