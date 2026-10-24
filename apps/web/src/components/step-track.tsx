import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ReportStatus } from '@/lib/domain';

export type StepState = 'done' | 'now' | 'todo' | 'stopped';
export const trackSteps = ['received', 'reviewing', 'result'] as const;

/**
 * received → reviewing → result. The API has no separate "reviewing" status: a pending or flagged
 * report is being reviewed now; verified and rejected have a result; a withdrawn report stopped.
 */
export function trackStates(status: ReportStatus): [StepState, StepState, StepState] {
  switch (status) {
    case 'pending':
    case 'flagged': return ['done', 'now', 'todo'];
    case 'verified':
    case 'rejected': return ['done', 'done', 'done'];
    case 'withdrawn': return ['done', 'stopped', 'todo'];
  }
}

export function StepTrack({ status, className }: { status: ReportStatus; className?: string }) {
  const { t } = useTranslation();
  const states = trackStates(status);
  return (
    <ol aria-label={t('steps.label')} className={cn('mt-1 grid grid-cols-3', className)}>
      {trackSteps.map((step, index) => {
        const state = states[index]!;
        return (
          <li key={step} data-state={state} aria-current={state === 'now' ? 'step' : undefined}
            className={cn('step font-heading text-[0.9375rem] leading-[1.35] font-medium text-muted-foreground',
              state === 'done' && 'text-foreground', state === 'now' && 'font-semibold text-signal-foreground')}>
            <span className="step-dot" aria-hidden="true">{state === 'done' && <Check className="size-3.5" strokeWidth={3.5} />}</span>
            <span>{t(`steps.${step}`)}</span>
            {state !== 'todo' && <span className="sr-only">({t(state === 'now' ? 'steps.current' : state === 'done' ? 'steps.done' : 'steps.stopped')})</span>}
          </li>
        );
      })}
    </ol>
  );
}
