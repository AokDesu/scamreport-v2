import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { statuses } from '@/lib/domain';
import { StatusBadge } from './status-badge';
import { TicketNumber } from './ticket';
import { ticketParts } from '@/lib/format';
import { StepTrack } from './step-track';

function track(status: Parameters<typeof StepTrack>[0]['status']) {
  const { container } = render(<StepTrack status={status} />);
  const steps = within(within(container).getByRole('list', { name: 'ความคืบหน้าของเรื่อง' })).getAllByRole('listitem');
  return steps.map(step => step.dataset.state);
}

describe('three-step track', () => {
  test('pending and flagged reports are being reviewed now', () => {
    expect(track('pending')).toEqual(['done', 'now', 'todo']);
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain('กำลังตรวจ');
  });
  test('flagged stays in review rather than jumping to a result', () => {
    expect(track('flagged')).toEqual(['done', 'now', 'todo']);
  });
  test('verified and rejected reports have reached the result step with no current step', () => {
    expect(track('verified')).toEqual(['done', 'done', 'done']);
    expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull();
    expect(track('rejected')).toEqual(['done', 'done', 'done']);
  });
  test('a withdrawn report shows that review stopped and never shows a result', () => {
    expect(track('withdrawn')).toEqual(['done', 'stopped', 'todo']);
  });
});

describe('status badge', () => {
  const thai = { pending: 'รอตรวจสอบ', verified: 'ยืนยันแล้ว', rejected: 'ไม่ผ่าน', withdrawn: 'ถอนแล้ว', flagged: 'ตรวจเพิ่มเติม' };
  const english = { pending: 'Pending', verified: 'Verified', rejected: 'Not accepted', withdrawn: 'Withdrawn', flagged: 'Closer look' };
  test.each(statuses)('%s shows a translated word in Thai and English, never the status code', async status => {
    const { container, rerender } = render(<StatusBadge status={status} audience="citizen" />);
    expect(container.textContent).toBe(thai[status]);
    await i18n.changeLanguage('en');
    rerender(<StatusBadge status={status} audience="citizen" />);
    expect(container.textContent).toBe(english[status]);
    expect(container.textContent).not.toBe(status);
    expect(container.querySelector('svg')).not.toBeNull();
  });
  test('staff see the moderation word for flagged', () => {
    const { container } = render(<StatusBadge status="flagged" />);
    expect(container.textContent).toBe('ติดธง');
  });
});

describe('ticket number', () => {
  test('is exposed to assistive technology as one readable reference', () => {
    const { prefix, number } = ticketParts(4812, '2026-10-24T07:00:00Z');
    render(<TicketNumber ticketNo={4812} createdAt="2026-10-24T07:00:00Z" />);
    expect(screen.getByText(prefix + number, { ignore: '[aria-hidden="true"]' }).className).toContain('sr-only');
    expect(screen.getAllByText(/./).filter(node => node.getAttribute('aria-hidden') !== 'true' && node.textContent === prefix + number)).toHaveLength(1);
  });
});
