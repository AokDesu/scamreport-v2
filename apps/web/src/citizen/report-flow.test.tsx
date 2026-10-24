import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@scamreport/shared';
import i18n from '@/i18n';
import type * as ApiModule from '@/lib/api';
import { ApiFailure } from '@/lib/api';
import { ReportFlow } from './report-flow';
import { normalizeAmount, toReportInput, type ReportValues } from './report-schema';

// The API client is the only replaced edge; the real ApiFailure class keeps status handling honest.
const calls: Array<{ path: string; init?: RequestInit }> = [];
let reply: (path: string, init?: RequestInit) => unknown;
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('@/lib/api');
  return {
    ApiFailure: actual.ApiFailure,
    failureMessageKey: () => 'errors.generic',
    api: vi.fn(async (path: string, init?: RequestInit) => { calls.push({ path, init }); return reply(path, init); }),
  };
});
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} }, sessionWasStored: false }));

const bank = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Demo River Bank / ธนาคารสาธิต' };
const unit = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Demo City Safety Unit / หน่วยงานสาธิต' };
const me: Me = { id: '10000000-0000-4000-8000-000000000001', email: 'citizen@demo.example.test', role: 'citizen', memberships: [] };
const created = { id: '30000000-0000-4000-8000-000000000001', ticket_no: 4812, created_at: '2026-10-24T07:00:00Z', status: 'pending' };

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/citizen/report']}>
        <Routes>
          <Route path="/citizen/report" element={<ReportFlow me={me} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function fillDetails({ amount = '2,500', story = 'ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน' } = {}) {
  fireEvent.click(screen.getByRole('radio', { name: 'ซื้อของออนไลน์ / พัสดุปลอม' }));
  fireEvent.click(screen.getByRole('radio', { name: 'SMS' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'เสียเงินไปเท่าไร' }), { target: { value: amount } });
  fireEvent.change(screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }), { target: { value: story } });
  fireEvent.click(screen.getByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
  return screen.findByRole('heading', { level: 1, name: 'ให้หน่วยงานติดต่อคุณได้ไหม' });
}
async function submitConsent(choice: RegExp) {
  fireEvent.click(await screen.findByRole('radio', { name: 'ธนาคารสาธิต' }));
  fireEvent.click(screen.getByRole('radio', { name: choice }));
  // The double-click guard ignores a submit right after the step change.
  await new Promise(resolve => setTimeout(resolve, 850));
  fireEvent.click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
}
const posted = () => JSON.parse(String(calls.find(call => call.path === '/reports' && call.init?.method === 'POST')?.init?.body));

beforeEach(() => {
  calls.length = 0;
  reply = path => path === '/tenants' ? [unit, bank] : created;
});

describe('report form', () => {
  test('stays on step 1 and names every missing answer in Thai', async () => {
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
    expect(await screen.findByText('เลือกแบบที่ถูกหลอก')).toBeTruthy();
    expect(screen.getByText('เลือกช่องทางที่มิจฉาชีพติดต่อ')).toBeTruthy();
    expect(screen.getByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeTruthy();
    expect(screen.getByText('เล่าเหตุการณ์อย่างน้อย 10 ตัวอักษร')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'แจ้งเหตุมิจฉาชีพ' })).toBeTruthy();
    expect(calls.some(call => call.path === '/reports')).toBe(false);
  });

  test('rejects an amount the API would refuse, and "no money lost" removes that requirement', async () => {
    renderFlow();
    fireEvent.change(screen.getByRole('textbox', { name: 'เสียเงินไปเท่าไร' }), { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
    expect(await screen.findByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ไม่ได้เสียเงิน' }));
    await waitFor(() => expect(screen.queryByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeNull());
  });

  test('with consent, sends the exact API body including the contact snapshot', async () => {
    renderFlow();
    await fillDetails();
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: '02-555-0101' } });
    await submitConsent(/^ยินยอม ให้ติดต่อกลับได้/);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/citizen/report/received/${created.id}`));
    expect(posted()).toEqual({
      organization_id: bank.id, scam_type: 'shopping', channel: 'sms', amount: '2500',
      description: 'ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน', consent_contact: true,
      contact_email: 'citizen@demo.example.test', contact_phone: '02-555-0101',
    });
  });

  test('without consent, no contact detail leaves the device', async () => {
    renderFlow();
    await fillDetails();
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: '02-555-0101' } });
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(calls.some(call => call.path === '/reports')).toBe(true));
    const body = posted();
    expect(body.consent_contact).toBe(false);
    expect(body).not.toHaveProperty('contact_email');
    expect(body).not.toHaveProperty('contact_phone');
  });

  test('consent step requires a destination and a consent choice before sending', async () => {
    renderFlow();
    await fillDetails();
    await new Promise(resolve => setTimeout(resolve, 850));
    fireEvent.click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    expect(await screen.findByText('เลือกหน่วยงานที่จะรับเรื่อง')).toBeTruthy();
    expect(screen.getByText('เลือกว่าจะให้ติดต่อกลับหรือไม่')).toBeTruthy();
    expect(calls.some(call => call.path === '/reports')).toBe(false);
  });

  test('a 403 from the API opens Unauthorized instead of showing a raw error', async () => {
    reply = (path, init) => {
      if (path === '/tenants') return [unit, bank];
      if (init?.method === 'POST') throw new ApiFailure(403, 'FORBIDDEN', 'req-403');
      return created;
    };
    renderFlow();
    await fillDetails();
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/unauthorized'));
  });

  test('the English switch relabels every choice without exposing API codes', async () => {
    renderFlow();
    await i18n.changeLanguage('en');
    const types = await screen.findByRole('radiogroup', { name: 'Type of scam' });
    const labels = within(types).getAllByRole('radio').map(radio => radio.textContent);
    expect(labels).toEqual(['Online shopping / fake parcel', 'Investment', 'Posing as an official', 'Fake link asking for details', 'Something else']);
    for (const code of ['impersonation', 'phishing', 'investment', 'scam_type', 'consent_contact']) expect(document.body.textContent).not.toContain(code);
  });
});

describe('report payload rules', () => {
  test('amounts normalise to the API decimal format and refuse what the API refuses', () => {
    expect(normalizeAmount('฿ 2,500')).toBe('2500');
    expect(normalizeAmount('0012.50')).toBe('12.50');
    expect(normalizeAmount('999999999999.99')).toBe('999999999999.99');
    expect(normalizeAmount('1000000000000')).toBeNull();
    expect(normalizeAmount('1.001')).toBeNull();
    expect(normalizeAmount('-5')).toBeNull();
    expect(normalizeAmount('')).toBeNull();
  });
  test('"no money lost" sends zero whatever was typed', () => {
    const values = { scam_type: 'other', channel: 'other', no_loss: true, amount: 'abc', description: ' ten chars long ', organization_id: bank.id, consent: 'no', contact_email: 'x@example.test', contact_phone: '1' } as ReportValues;
    expect(toReportInput(values)).toEqual({ organization_id: bank.id, scam_type: 'other', channel: 'other', amount: '0', description: 'ten chars long', consent_contact: false });
  });
});
