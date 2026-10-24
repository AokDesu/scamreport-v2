import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ticketParts } from '@/lib/format';

/** Condensed ticket number "SR-69- 04812"; screen readers hear it as one reference. */
export function TicketNumber({ ticketNo, createdAt, size = 'lg', className }: { ticketNo: number; createdAt: string; size?: 'lg' | 'md' | 'sm'; className?: string }) {
  const { prefix, number } = ticketParts(ticketNo, createdAt);
  return (
    <span aria-label={prefix + number} className={cn('inline-flex items-baseline gap-0.5 font-ticket leading-none font-bold tracking-[0.01em] tabular-nums',
      size === 'lg' ? 'text-ticket' : size === 'md' ? 'text-[2.25rem]' : 'text-xl', className)}>
      <span aria-hidden="true" className={cn('mr-0.5 tracking-[0.04em] whitespace-nowrap opacity-75', size === 'sm' ? 'text-xs' : 'text-base')}>{prefix}</span>
      <span aria-hidden="true">{number}</span>
    </span>
  );
}

/**
 * The notched report ticket: header with the reference number and a status slot, a dashed tear line,
 * then the body. `tear` positions the notches at the tear line.
 */
export function Ticket({ ticketNo, createdAt, badge, children, className, tear = '5.25rem', as: Tag = 'article', labelledBy }: {
  ticketNo: number; createdAt: string; badge?: ReactNode; children?: ReactNode; className?: string; tear?: string;
  as?: 'article' | 'div'; labelledBy?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('ticket-shadow', className)}>
      <Tag className="ticket" style={{ ['--tear' as string]: tear }} aria-labelledby={labelledBy}>
        <div className="flex items-start justify-between gap-3 px-5 pt-3.5" style={{ height: tear }}>
          <div className="flex flex-col">
            <span className="mb-1 font-heading text-xs font-medium text-muted-foreground">{t('ticket.label')}</span>
            <TicketNumber ticketNo={ticketNo} createdAt={createdAt} />
          </div>
          {badge}
        </div>
        <div className="ticket-tear" aria-hidden="true" />
        {children && <div className="flex flex-col gap-3 px-5 pt-4 pb-4.5">{children}</div>}
      </Tag>
    </div>
  );
}

/** Red identifier chip: how the scammer reached people (danger is the only use of red besides destructive actions). */
export function IdentifierChip({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-2 self-start rounded-sm bg-danger-soft px-3 py-1.5 font-[Noto_Sans,var(--font-sans)] text-base font-semibold text-danger-soft-foreground [overflow-wrap:anywhere]', className)}>
      <Icon aria-hidden="true" className="size-4.5" />
      {children}
    </span>
  );
}
