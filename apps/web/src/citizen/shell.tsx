import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, ShieldAlert, TicketCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Brand } from '@/components/brand';
import { LanguageToggle } from '@/components/language-toggle';

/** Phone-width column (390px design) centred on a soft mint surround on wider screens. */
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#dcebe5]">
      <div className="relative mx-auto flex min-h-dvh max-w-[390px] flex-col bg-background">{children}</div>
    </div>
  );
}

/** Bare phone-width screen (loading, errors, not found) that still carries the language switch. */
export function PlainScreen({ children }: { children: ReactNode }) {
  return (
    <MobileFrame>
      <div className="flex min-h-12 justify-end px-5 pt-3"><LanguageToggle tone="light" /></div>
      {children}
    </MobileFrame>
  );
}

/** Teal header band. `back` replaces the brand with a back link; `overlap` lets the body card rise into the band. */
export function CitizenHeader({ title, subtitle, back, overlap = true, children }: {
  title: string; subtitle?: ReactNode; back?: { to: string; onClick?: () => void }; overlap?: boolean; children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className={cn('bg-sidebar px-5 pt-3 text-sidebar-foreground', overlap ? 'pb-13' : 'pb-5')}>
      <div className="flex min-h-12 items-center justify-between">
        {back
          ? <Link to={back.to} onClick={back.onClick} className="-ml-2 inline-flex min-h-12 items-center gap-1 rounded-sm px-2 font-heading text-base font-medium text-sidebar-foreground no-underline">
              <ArrowLeft aria-hidden="true" className="size-5" />{t('app.back')}
            </Link>
          : <Link to="/citizen/feed" className="inline-flex min-h-12 items-center rounded-sm text-sidebar-foreground no-underline"><Brand /></Link>}
        <LanguageToggle />
      </div>
      <h1 className="mt-3 text-2xl leading-[1.3] text-white">{title}</h1>
      {subtitle && <div className="mt-1 text-base leading-[1.55] text-sidebar-muted">{subtitle}</div>}
      {children}
    </header>
  );
}

export function CitizenBody({ children, overlap = true, className }: { children: ReactNode; overlap?: boolean; className?: string }) {
  return <main id="main" className={cn('relative flex flex-1 flex-col gap-4 px-4 pb-28', overlap ? '-mt-8' : 'pt-5', className)}>{children}</main>;
}

const tabs: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/citizen/feed', label: 'nav.feed', icon: ShieldAlert },
  { to: '/citizen/report', label: 'nav.report', icon: Plus },
  { to: '/citizen/reports', label: 'nav.reports', icon: TicketCheck },
];
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-[390px] -translate-x-1/2 grid-cols-3 bg-card px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--border),0_-8px_24px_-12px_rgb(2_60_62/0.18)]">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/citizen/report'}
          className={({ isActive }) => cn('relative flex min-h-15 flex-col items-center justify-center gap-0.5 rounded-md font-heading text-[0.9375rem] font-medium text-muted-foreground no-underline',
            isActive && 'tab-active font-semibold text-primary')}>
          <Icon aria-hidden="true" className="size-6.5" />{t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

/** Fixed bottom action area used by the report flow instead of the tab bar. */
export function BottomActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-[390px] -translate-x-1/2 flex-col gap-2 bg-gradient-to-t from-background from-70% to-transparent px-4 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/** Sign in, Session Expired and Unauthorized: teal gate with a rising sheet. */
export function GateLayout({ icon, iconTone = 'signal', title, lead, children }: {
  icon?: LucideIcon; iconTone?: 'signal' | 'danger'; title: string; lead: string; children: ReactNode;
}) {
  const Icon = icon;
  return (
    <MobileFrame>
      <div className="relative bg-sidebar px-5 pt-3 pb-18 text-sidebar-foreground">
        <div className="flex min-h-12 items-center justify-between"><Brand /><LanguageToggle /></div>
        {Icon && (
          <div aria-hidden="true" className={cn('mt-6 grid size-18 place-items-center rounded-[20px]', iconTone === 'signal' ? 'bg-signal text-sidebar' : 'bg-card text-destructive')}>
            <Icon className="size-9" />
          </div>
        )}
        <h1 className={cn('text-3xl leading-[1.3] whitespace-pre-line text-white', Icon ? 'mt-4' : 'mt-6')}>{title}</h1>
        <p className="mt-2 text-[1.0625rem] leading-[1.6] text-sidebar-muted">{lead}</p>
      </div>
      <main id="main" className="relative -mt-9 flex flex-1 flex-col gap-4.5 rounded-t-2xl bg-background px-5 pt-6 pb-8">{children}</main>
    </MobileFrame>
  );
}
