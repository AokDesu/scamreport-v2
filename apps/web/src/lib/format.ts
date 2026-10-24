import type { TFunction } from 'i18next';

const locale = (language: string) => language === 'en' ? 'en-GB' : 'th-TH';

/** Ticket reference "SR-69-04812": Buddhist-era year of filing (two digits) and the server ticket number. */
export function ticketParts(ticketNo: number, createdAt: string) {
  const beYear = new Date(createdAt).getFullYear() + 543;
  return { prefix: `SR-${String(beYear % 100).padStart(2, '0')}-`, number: String(ticketNo).padStart(5, '0') };
}
export function ticketLabel(ticketNo: number, createdAt: string) {
  const { prefix, number } = ticketParts(ticketNo, createdAt);
  return prefix + number;
}

export function money(amount: number, language: string) {
  return new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
export function compactMoney(amount: number, language: string) {
  return new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'THB', notation: 'compact', maximumFractionDigits: 2 }).format(amount);
}
export function count(value: number, language: string) {
  return new Intl.NumberFormat(locale(language)).format(value);
}
export function percent(value: number, language: string) {
  return new Intl.NumberFormat(locale(language), { style: 'percent', maximumFractionDigits: 0 }).format(value);
}
/** "23 ต.ค. 2569" in Thai (Buddhist era), "23 Oct 2026" in English. */
export function date(value: string, language: string) {
  return new Intl.DateTimeFormat(locale(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
export function shortDate(value: string, language: string) {
  return new Intl.DateTimeFormat(locale(language), { day: 'numeric', month: 'short' }).format(new Date(value));
}
export function time(value: string, language: string, seconds = false) {
  return new Intl.DateTimeFormat(locale(language), { hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, hourCycle: 'h23' }).format(new Date(value));
}
export function dateTime(value: string, language: string) {
  return `${date(value, language)} · ${time(value, language)}`;
}
/** Waiting time in the queue: minutes, then hours and minutes, then days. */
export function elapsed(since: string, t: TFunction, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutes', { count: minutes });
  if (minutes < 48 * 60) return t('time.hours', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') });
  return t('time.days', { count: Math.floor(minutes / 1440) });
}

/**
 * Seeded organization names carry both languages as "English / ไทย"; show the half for the
 * current language. A name without the separator is shown as is.
 */
export function orgName(name: string | undefined, language: string) {
  if (!name) return '';
  const [english, thai] = name.split(' / ');
  return (language === 'en' ? english : thai ?? english)!.trim();
}
/** Two leading graphemes for avatar and organization marks. */
export function initials(name: string) {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  const graphemes = (text: string) => [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text)].map(s => s.segment);
  const first = graphemes(words[0] ?? '?');
  return words.length > 1 ? first[0]! + graphemes(words[1]!)[0]! : first.slice(0, 2).join('');
}
