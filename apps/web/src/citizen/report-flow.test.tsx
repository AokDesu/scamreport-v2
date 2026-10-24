import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@scamreport/shared';
import i18n from '@/i18n';
import type * as ApiModule from '@/lib/api';
import { ApiFailure } from '@/lib/api';
import { drafts, type Draft } from '@/lib/draft';
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
// Device draft store (IndexedDB in the browser) as an in-memory map per account.
const savedDrafts = new Map<string, Draft>();
vi.mock('@/lib/draft', () => ({
  drafts: {
    load: async (userId: string) => savedDrafts.get(userId),
    save: async (userId: string, draft: Draft) => { savedDrafts.set(userId, draft); },
    remove: async (userId: string) => { savedDrafts.delete(userId); },
  },
}));

const bank = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Demo River Bank / ธนาคารสาธิต' };
const unit = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Demo City Safety Unit / หน่วยงานสาธิต' };
const me: Me = { id: '10000000-0000-4000-8000-000000000001', email: 'citizen@demo.example.test', role: 'citizen', memberships: [] };
const created = { id: '30000000-0000-4000-8000-000000000001', ticket_no: 4812, created_at: '2026-10-24T07:00:00Z', status: 'pending' };

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
async function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/citizen/report']}>
        <Routes>
          <Route path="/citizen/report" element={<ReportFlow me={me} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    { reactStrictMode: true }, // the app renders in StrictMode; effects must survive the double mount
  );
  // The form appears once the device draft store has answered.
  await screen.findByRole('radiogroup', { name: 'ถูกหลอกแบบไหน' });
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
  vi.restoreAllMocks();
  calls.length = 0;
  savedDrafts.clear();
  reply = path => path === '/tenants' ? [unit, bank] : created;
});

describe('report form', () => {
  test('stays on step 1 and names every missing answer in Thai', async () => {
    await renderFlow();
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
    expect(await screen.findByText('เลือกแบบที่ถูกหลอก')).toBeTruthy();
    expect(screen.getByText('เลือกช่องทางที่มิจฉาชีพติดต่อ')).toBeTruthy();
    expect(screen.getByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeTruthy();
    expect(screen.getByText('เล่าเหตุการณ์อย่างน้อย 10 ตัวอักษร')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'แจ้งเหตุมิจฉาชีพ' })).toBeTruthy();
    expect(calls.some(call => call.path === '/reports')).toBe(false);
  });

  test('rejects an amount the API would refuse, and "no money lost" removes that requirement', async () => {
    await renderFlow();
    fireEvent.change(screen.getByRole('textbox', { name: 'เสียเงินไปเท่าไร' }), { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
    expect(await screen.findByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ไม่ได้เสียเงิน' }));
    await waitFor(() => expect(screen.queryByText('กรอกจำนวนเงินเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง')).toBeNull());
  });

  test('with consent, sends the exact API body including the contact snapshot', async () => {
    await renderFlow();
    await fillDetails();
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: '0X-XXX-1001' } });
    await submitConsent(/^ยินยอม ให้ติดต่อกลับได้/);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/citizen/report/received/${created.id}`));
    expect(posted()).toEqual({
      organization_id: bank.id, scam_type: 'shopping', channel: 'sms', amount: '2500',
      description: 'ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน', consent_contact: true,
      contact_email: 'citizen@demo.example.test', contact_phone: '0X-XXX-1001',
    });
  });

  test('without consent, no contact detail leaves the device', async () => {
    await renderFlow();
    await fillDetails();
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: 'X'.repeat(41) } });
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(calls.some(call => call.path === '/reports')).toBe(true));
    const body = posted();
    expect(body.consent_contact).toBe(false);
    expect(body).not.toHaveProperty('contact_email');
    expect(body).not.toHaveProperty('contact_phone');
  });

  test('an overlong consented phone names and associates its translated error', async () => {
    await renderFlow();
    await fillDetails();
    const phone = screen.getByRole('textbox', { name: 'เบอร์โทร' });
    fireEvent.change(phone, { target: { value: 'X'.repeat(41) } });
    await submitConsent(/^ยินยอม ให้ติดต่อกลับได้/);
    expect(await screen.findByText('กรอกเบอร์โทรไม่เกิน 40 ตัวอักษร')).toBeTruthy();
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(phone.getAttribute('aria-describedby')!)?.textContent).toContain('40');
    expect(calls.some(call => call.path === '/reports')).toBe(false);
    await i18n.changeLanguage('en');
    expect(await screen.findByText('Keep the phone number within 40 characters')).toBeTruthy();
  });

  test('consent step requires a destination and a consent choice before sending', async () => {
    await renderFlow();
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
    await renderFlow();
    await fillDetails();
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/unauthorized'));
  });

  test('the English switch relabels every choice without exposing API codes', async () => {
    await renderFlow();
    await i18n.changeLanguage('en');
    const types = await screen.findByRole('radiogroup', { name: 'Type of scam' });
    const labels = within(types).getAllByRole('radio').map(radio => radio.textContent);
    expect(labels).toEqual(['Online shopping / fake parcel', 'Investment', 'Posing as an official', 'Fake link asking for details', 'Something else']);
    for (const code of ['impersonation', 'phishing', 'investment', 'scam_type', 'consent_contact']) expect(document.body.textContent).not.toContain(code);
  });
});

describe('report draft (kept through Session Expired)', () => {
  const story = 'กลุ่ม LINE ชวนลงทุนทองคำ ปันผล 30% ต่อเดือน ถอนเงินไม่ได้';
  test('typing autosaves every answer for this account only', async () => {
    await renderFlow();
    fireEvent.click(screen.getByRole('radio', { name: 'ชวนลงทุน' }));
    fireEvent.click(screen.getByRole('radio', { name: 'โซเชียล (LINE, Facebook)' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'เสียเงินไปเท่าไร' }), { target: { value: '45000' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }), { target: { value: story } });
    await waitFor(() => expect(savedDrafts.get(me.id)).toMatchObject({ scam_type: 'investment', channel: 'social', amount: '45000', description: story }));
    expect([...savedDrafts.keys()]).toEqual([me.id]);
  });
  test('signing in again restores every answer, including the typed story', async () => {
    savedDrafts.set(me.id, { scam_type: 'investment', channel: 'social', amount: '45000', no_loss: false, description: story, contact_email: me.email });
    await renderFlow();
    expect(screen.getByRole('radio', { name: 'ชวนลงทุน' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'โซเชียล (LINE, Facebook)' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('textbox', { name: 'เสียเงินไปเท่าไร' }) as HTMLInputElement).value).toBe('45000');
    expect((screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }) as HTMLTextAreaElement).value).toBe(story);
    // The restored draft must survive the next autosave untouched.
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(savedDrafts.get(me.id)).toMatchObject({ description: story, amount: '45000' });
  });
  test('a successful submit deletes the draft so it cannot be sent twice', async () => {
    await renderFlow();
    await fillDetails();
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/citizen/report/received/${created.id}`));
    // A pending autosave must not bring the draft back after it was removed.
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(savedDrafts.has(me.id)).toBe(false);
  });
  const attachSlip = () => fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
    target: { files: [new File(['%PDF-1.4'], 'slip.pdf', { type: 'application/pdf' })] },
  });
  const evidenceCalls = () => calls.filter(call => call.path.endsWith('/evidence'));
  test('immediate consent edits are durable before a create-time 401', async () => {
    await renderFlow();
    attachSlip();
    await fillDetails();
    await new Promise(resolve => setTimeout(resolve, 850));
    fireEvent.click(screen.getByRole('radio', { name: 'ธนาคารสาธิต' }));
    fireEvent.click(screen.getByRole('radio', { name: /^ยินยอม ให้ติดต่อกลับได้/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: '0X-XXX-1002' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'อีเมล' }), { target: { value: 'latest@demo.example.test' } });
    reply = path => {
      if (path === '/tenants') return [unit, bank];
      expect(savedDrafts.get(me.id)).toMatchObject({ organization_id: bank.id, consent: 'yes', contact_email: 'latest@demo.example.test', contact_phone: '0X-XXX-1002' });
      expect(savedDrafts.get(me.id)?.files?.[0]?.name).toBe('slip.pdf');
      throw new ApiFailure(401, 'SESSION_EXPIRED', 'create-expired');
    };
    fireEvent.click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    await waitFor(() => expect(calls.some(call => call.path === '/reports')).toBe(true));
    expect(savedDrafts.get(me.id)?.sent).toBeUndefined();
  });
  test('a failed initial checkpoint stops creation and a failed sent checkpoint stops uploads', async () => {
    await renderFlow();
    attachSlip();
    await fillDetails();
    fireEvent.click(screen.getByRole('radio', { name: 'ธนาคารสาธิต' }));
    fireEvent.click(screen.getByRole('radio', { name: /^ไม่ยินยอม/ }));
    await new Promise(resolve => setTimeout(resolve, 850));
    const save = vi.spyOn(drafts, 'save').mockRejectedValueOnce(new Error('storage failed'));
    fireEvent.click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    await screen.findByRole('alert');
    expect(calls.some(call => call.path === '/reports')).toBe(false);
    reply = path => {
      if (path === '/tenants') return [unit, bank];
      save.mockRejectedValueOnce(new Error('checkpoint failed'));
      return created;
    };
    fireEvent.click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    await screen.findByRole('button', { name: 'ลองแนบหลักฐานอีกครั้ง' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'ลองแนบหลักฐานอีกครั้ง' }).hasAttribute('disabled')).toBe(false));
    expect(evidenceCalls()).toHaveLength(0);
  });
  test('discard cancels an autosave while draft deletion is pending', async () => {
    savedDrafts.set(me.id, { description: story, files: [new File(['%PDF-1.4'], 'left.pdf', { type: 'application/pdf' })], sent: { reportId: created.id, attached: 0 } });
    await renderFlow();
    let finish!: () => void;
    vi.spyOn(drafts, 'remove').mockImplementation(async userId => {
      savedDrafts.delete(userId);
      await new Promise<void>(resolve => { finish = resolve; });
      return undefined;
    });
    const save = vi.spyOn(drafts, 'save');
    fireEvent.change(screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }), { target: { value: story + ' ล่าสุด' } });
    fireEvent.click(screen.getByRole('button', { name: 'ทิ้งไฟล์และเริ่มแจ้งเรื่องใหม่' }));
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(save).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(screen.queryByText('เรื่องนี้ส่งไปแล้ว')).toBeNull());
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(savedDrafts.has(me.id)).toBe(false);
  });
  test('a failed upload keeps the draft, the file and the report ID, and the retry attaches to the same report', async () => {
    let uploadsFail = true;
    reply = path => {
      if (path === '/tenants') return [unit, bank];
      if (path.endsWith('/evidence')) { if (uploadsFail) throw new ApiFailure(500, 'INTERNAL_ERROR', 'req-500'); return { path: `${created.id}/slip.pdf` }; }
      return created;
    };
    await renderFlow();
    attachSlip();
    await fillDetails();
    await submitConsent(/^ไม่ยินยอม/);
    const retry = await screen.findByRole('button', { name: 'ลองแนบหลักฐานอีกครั้ง' });
    await waitFor(() => expect(savedDrafts.get(me.id)?.sent).toEqual({ reportId: created.id, attached: 0 }));
    expect(savedDrafts.get(me.id)?.files?.map(file => file.name)).toEqual(['slip.pdf']);
    uploadsFail = false;
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/citizen/report/received/${created.id}`));
    expect(calls.filter(call => call.path === '/reports' && call.init?.method === 'POST')).toHaveLength(1);
    expect(evidenceCalls().map(call => call.path)).toEqual([`/reports/${created.id}/evidence`, `/reports/${created.id}/evidence`]);
    expect(savedDrafts.has(me.id)).toBe(false);
  });
  test('a session that expires during the upload keeps the file and the report ID for after signing in again', async () => {
    reply = path => {
      if (path === '/tenants') return [unit, bank];
      if (path.endsWith('/evidence')) throw new ApiFailure(401, 'SESSION_EXPIRED', 'req-401');
      return created;
    };
    await renderFlow();
    attachSlip();
    await fillDetails();
    await submitConsent(/^ไม่ยินยอม/);
    await waitFor(() => expect(evidenceCalls()).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(screen.queryByTestId('where')).toBeNull();
    expect(savedDrafts.get(me.id)?.sent).toEqual({ reportId: created.id, attached: 0 });
    expect(savedDrafts.get(me.id)?.files).toHaveLength(1);
    expect(savedDrafts.get(me.id)?.description).toBe('ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน');
  });
  test('a restored draft with a sent report can be discarded to start a new report without touching the sent one', async () => {
    savedDrafts.set(me.id, {
      scam_type: 'shopping', channel: 'sms', amount: '2500', no_loss: false, description: 'ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน', organization_id: bank.id, consent: 'no',
      contact_email: me.email, files: [new File(['%PDF-1.4'], 'left.pdf', { type: 'application/pdf' })], sent: { reportId: created.id, attached: 0 },
    });
    await renderFlow();
    expect(screen.getByText('เรื่องนี้ส่งไปแล้ว')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ทิ้งไฟล์และเริ่มแจ้งเรื่องใหม่' }));
    await waitFor(() => expect(screen.queryByText('เรื่องนี้ส่งไปแล้ว')).toBeNull());
    expect((screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }) as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByText('left.pdf')).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(savedDrafts.has(me.id)).toBe(false);
    expect(calls.some(call => call.path.startsWith('/reports'))).toBe(false);
  });
  test('after signing in again a restored draft with a created report only uploads the remaining files', async () => {
    savedDrafts.set(me.id, {
      scam_type: 'shopping', channel: 'sms', amount: '2500', no_loss: false, description: 'ได้ SMS ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงิน', organization_id: bank.id, consent: 'no',
      contact_email: me.email, files: [new File(['%PDF-1.4'], 'left.pdf', { type: 'application/pdf' })], sent: { reportId: created.id, attached: 1 }, step: 'consent',
    });
    reply = path => path === '/tenants' ? [unit, bank] : { path: 'x' };
    await renderFlow();
    fireEvent.change(screen.getByRole('textbox', { name: 'เล่าเหตุการณ์' }), { target: { value: '' } });
    fireEvent.click(await screen.findByRole('button', { name: 'ถัดไป: เลือกผู้ที่ติดต่อคุณได้' }));
    await screen.findByRole('heading', { level: 1, name: 'ให้หน่วยงานติดต่อคุณได้ไหม' });
    fireEvent.change(screen.getByRole('textbox', { name: 'อีเมล' }), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'เบอร์โทร' }), { target: { value: 'X'.repeat(41) } });
    await new Promise(resolve => setTimeout(resolve, 850));
    fireEvent.click(screen.getByRole('button', { name: 'ลองแนบหลักฐานอีกครั้ง' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/citizen/report/received/${created.id}`));
    expect(calls.some(call => call.path === '/reports' && call.init?.method === 'POST')).toBe(false);
    expect(evidenceCalls()).toHaveLength(1);
    expect(savedDrafts.has(me.id)).toBe(false);
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
