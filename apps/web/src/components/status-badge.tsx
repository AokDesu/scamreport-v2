import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { statusIcon, type ReportStatus } from '@/lib/domain';

const tone: Record<ReportStatus, string> = {
  pending: 'bg-status-pending text-status-pending-foreground',
  verified: 'bg-status-verified text-status-verified-foreground',
  rejected: 'bg-status-rejected text-status-rejected-foreground',
  withdrawn: 'bg-status-withdrawn text-status-withdrawn-foreground',
  flagged: 'bg-status-flagged text-status-flagged-foreground',
};

/** The fixed five-state legend: always an icon plus a translated word, never a raw status code. */
export function StatusBadge({ status, audience = 'staff', className }: { status: ReportStatus; audience?: 'citizen' | 'staff'; className?: string }) {
  const { t } = useTranslation();
  const Icon = statusIcon[status];
  return (
    <span data-status={status} className={cn('inline-flex items-center gap-1.5 rounded-full py-0.75 pr-3 pl-2.25 font-heading text-[0.9375rem] leading-normal font-semibold whitespace-nowrap', tone[status], className)}>
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {t(audience === 'citizen' ? `statusCitizen.${status}` : `status.${status}`)}
    </span>
  );
}
