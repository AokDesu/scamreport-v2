import { z } from 'zod';
import type { ReportInput } from '@scamreport/shared';
import { channels, scamTypes, type Channel, type ScamType } from '@/lib/domain';

// Error messages are translation keys; the form renders them with t().
const amountPattern = /^\d{1,12}(\.\d{1,2})?$/;
/** "2,500" or "฿ 2500.50" → "2500.50"; null when it is not a valid THB amount for the API. */
export function normalizeAmount(value: string): string | null {
  const cleaned = value.replace(/[\s,฿]/g, '');
  if (!amountPattern.test(cleaned)) return null;
  return cleaned.replace(/^0+(?=\d)/, '');
}

export const detailsSchema = z.object({
  scam_type: z.enum(scamTypes as [ScamType, ...ScamType[]], { error: 'report.errors.type' }),
  channel: z.enum(channels as [Channel, ...Channel[]], { error: 'report.errors.channel' }),
  no_loss: z.boolean(),
  amount: z.string(),
  description: z.string().trim().min(10, 'report.errors.story').max(5000, 'report.errors.storyLong'),
});
// Cross-field checks run even when other fields are still empty (`when`), so each step shows every
// problem at once instead of revealing them one after another.
const always = { when: () => true };
export const reportSchema = detailsSchema.extend({
  organization_id: z.uuid({ error: 'report.errors.destination' }),
  consent: z.enum(['yes', 'no'], { error: 'report.errors.consent' }),
  contact_email: z.string().trim(),
  contact_phone: z.string().trim(),
})
  .refine(values => values.no_loss || normalizeAmount(values.amount ?? '') !== null, { path: ['amount'], message: 'report.errors.amount', ...always })
  .refine(values => values.consent !== 'yes' || !values.contact_email || (values.contact_email.length <= 254 && z.email().safeParse(values.contact_email).success),
    { path: ['contact_email'], message: 'report.errors.email', ...always })
  .refine(values => values.consent !== 'yes' || values.contact_phone.length <= 40,
    { path: ['contact_phone'], message: 'report.errors.phone', ...always })
  .refine(values => values.consent !== 'yes' || Boolean(values.contact_email || values.contact_phone),
    { path: ['contact_email'], message: 'report.errors.contact', ...always });

export type ReportValues = z.input<typeof reportSchema>;
export const detailFields = ['scam_type', 'channel', 'no_loss', 'amount', 'description'] as const;
export const emptyReport: ReportValues = {
  scam_type: undefined as unknown as ScamType, channel: undefined as unknown as Channel, no_loss: false, amount: '', description: '',
  organization_id: undefined as unknown as string, consent: undefined as unknown as 'yes', contact_email: '', contact_phone: '',
};

/** The exact POST /reports body. Contact details are sent only with consent. */
export function toReportInput(values: ReportValues): ReportInput {
  const consented = values.consent === 'yes';
  return {
    organization_id: values.organization_id,
    scam_type: values.scam_type,
    channel: values.channel,
    amount: values.no_loss ? '0' : normalizeAmount(values.amount) ?? '0',
    description: values.description.trim(),
    consent_contact: consented,
    ...(consented && values.contact_email ? { contact_email: values.contact_email.trim() } : {}),
    ...(consented && values.contact_phone ? { contact_phone: values.contact_phone.trim() } : {}),
  };
}
