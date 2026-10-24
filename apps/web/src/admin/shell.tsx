import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChartColumn, ChevronRight, Inbox, Lock, LogOut, ScrollText, ShieldX, Users, type LucideIcon } from 'lucide-react';
import type { Me, MemberRole, QueueCounts, QueueTab, Report, RosterMember, Tenant } from '@scamreport/shared';
import { api, ApiFailure } from '@/lib/api';
import { orgName, time } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Brand, OrgMark } from '@/components/brand';
import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIdentity } from '@/auth/identity';

export type ConsolePage = 'queue' | 'activity' | 'members' | 'dashboard' | 'detail';
/** Which tenant roles may open each page. Mirrors the API checks; the API remains the authority. */
export const pageRoles: Record<ConsolePage, MemberRole[]> = {
  queue: ['moderator', 'org_admin'], detail: ['moderator', 'org_admin'], activity: ['org_admin'], members: ['org_admin'], dashboard: ['executive'],
};
const rolePriority: MemberRole[] = ['moderator', 'org_admin', 'executive'];

type Console = { me: Me; orgId: string; orgLabel: string; role: MemberRole; can: (page: ConsolePage) => boolean; home: string };
const ConsoleContext = createContext<Console | null>(null);
export function useConsole() {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('Console layout is required.');
  return value;
}

/** Staff names for the current organization (moderators and admins only; executives never call it). */
export function useRoster() {
  const { orgId, role } = useConsole();
  return useQuery({
    queryKey: ['members', orgId], queryFn: () => api<RosterMember[]>(`/members?organization_id=${orgId}`),
    enabled: role !== 'executive', staleTime: 60_000,
  });
}

const queueRetry = (count: number, error: Error) => !(error instanceof ApiFailure && error.status < 500) && count < 2;

/** Per-tab report totals from the server: the tab badges and the rail's pending count. */
export function useQueueCounts(enabled = true) {
  const { orgId } = useConsole();
  return useQuery({
    queryKey: ['queue', 'counts', orgId], queryFn: () => api<QueueCounts>(`/moderation/queue/counts?organization_id=${orgId}`), enabled, retry: queueRetry,
  });
}

/** One queue tab, served by the database in queue order (waiting tabs oldest first). */
export function useQueueTab(tab: QueueTab) {
  const { orgId } = useConsole();
  return useQuery({
    queryKey: ['queue', 'tab', orgId, tab], queryFn: () => api<Report[]>(`/moderation/queue?organization_id=${orgId}&status=${tab}&limit=100`), retry: queueRetry,
  });
}

/** The oldest pending report: who "Call next" and "Save and call next" open. Always read fresh. */
export const nextInLineQuery = (orgId: string) => ({
  queryKey: ['queue', 'next', orgId],
  queryFn: async () => (await api<Report[]>(`/moderation/queue?organization_id=${orgId}&status=pending&limit=1`))[0] ?? null,
  staleTime: 0, retry: queueRetry,
});
export function useNextInLine(enabled = true) {
  const { orgId } = useConsole();
  return useQuery({ ...nextInLineQuery(orgId), enabled });
}

function RailLink({ to, icon: Icon, label, locked, lockedRole, count }: { to: string; icon: LucideIcon; label: string; locked: boolean; lockedRole: string; count?: number }) {
  const { t } = useTranslation();
  return (
    <NavLink to={to} aria-description={locked ? t('admin.locked', { role: lockedRole }) : undefined}
      className={({ isActive }) => cn('relative flex min-h-11 items-center gap-3 rounded-sm px-3 font-heading text-[0.9375rem] font-medium text-sidebar-foreground no-underline hover:bg-sidebar-accent',
        isActive && 'rail-active bg-sidebar-accent font-semibold text-white', locked && 'text-sidebar-muted')}>
      <Icon aria-hidden="true" className="size-5" />
      <span className="flex-1">{label}</span>
      {locked
        ? <Lock aria-hidden="true" className="size-4" />
        : count !== undefined && count > 0 && <span className="min-w-6 rounded-full bg-sidebar-primary px-2 text-center font-[Noto_Sans] text-[0.8125rem] leading-6 font-bold text-sidebar-primary-foreground">{count}</span>}
    </NavLink>
  );
}

function Rail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useIdentity();
  const { me, orgId, orgLabel, role, can } = useConsole();
  const roster = useRoster();
  const counts = useQueueCounts(can('queue'));
  const self = roster.data?.find(member => member.user_id === me.id);
  const name = self?.display_name || me.email || '';
  const pending = counts.data?.pending;
  const needs = (page: ConsolePage) => pageRoles[page].map(r => t(`role.${r}`)).join(' / ');
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto bg-sidebar px-3.5 py-4.5 text-sidebar-foreground">
      <Link to="/admin" className="rounded-sm px-2 py-1 text-sidebar-foreground no-underline"><Brand className="text-lg" /></Link>
      <div className="flex items-center gap-3 rounded-lg bg-black/14 p-3 shadow-[inset_0_0_0_1px_var(--sidebar-border)]">
        <OrgMark name={orgLabel} id={orgId} className="size-10 rounded-sm text-base" />
        <div className="min-w-0">
          <p className="font-heading text-[0.9375rem] leading-[1.35] font-semibold text-white">{orgLabel}</p>
          <p className="text-[0.8125rem] leading-[1.4] text-sidebar-muted">{t('admin.orgUnit')}</p>
        </div>
      </div>
      <nav aria-label={t('admin.console')} className="flex flex-col gap-0.5">
        <p className="px-3 pt-2 pb-1 font-heading text-[0.8125rem] font-medium text-sidebar-muted">{t('admin.work')}</p>
        <RailLink to="/admin/queue" icon={Inbox} label={t('admin.queue')} locked={!can('queue')} lockedRole={needs('queue')} count={pending} />
        <RailLink to="/admin/activity" icon={ScrollText} label={t('admin.activity')} locked={!can('activity')} lockedRole={needs('activity')} />
        <p className="px-3 pt-4 pb-1 font-heading text-[0.8125rem] font-medium text-sidebar-muted">{t('admin.org')}</p>
        <RailLink to="/admin/members" icon={Users} label={t('admin.members')} locked={!can('members')} lockedRole={needs('members')} />
        <RailLink to="/admin/dashboard" icon={ChartColumn} label={t('admin.dashboard')} locked={!can('dashboard')} lockedRole={needs('dashboard')} />
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border px-2 py-3">
        <Avatar name={name} className="bg-sidebar-accent text-white" />
        <div className="min-w-0 flex-1">
          {/* Executives cannot read the staff roster, so their rail shows the sign-in email, kept to one line. */}
          <p title={name} className={cn('font-heading text-[0.9375rem] leading-[1.35] font-semibold text-white', self?.display_name ? '[overflow-wrap:anywhere]' : 'truncate')}>{name}</p>
          <span className="mt-0.5 inline-flex rounded-full bg-sidebar-primary px-2 font-heading text-[0.8125rem] leading-[1.6] font-semibold whitespace-nowrap text-sidebar-primary-foreground">{t(`role.${role}`)}</span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t('admin.signOut')} className="text-sidebar-muted hover:bg-sidebar-accent hover:text-white"
          onClick={async () => { await signOut(); navigate('/sign-in', { replace: true }); }}>
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}

/** Desktop console: teal rail, per-organization context, and the role's capabilities. */
export function ConsoleLayout({ me }: { me: Me }) {
  const { i18n, t } = useTranslation();
  const orgIds = useMemo(() => [...new Set(me.memberships.map(m => m.organization_id))], [me]);
  const [orgId, setOrgId] = useState(orgIds[0]!);
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<Tenant[]>('/tenants'), staleTime: 300_000 });
  const roles = me.memberships.filter(m => m.organization_id === orgId).map(m => m.role);
  const role = rolePriority.find(r => roles.includes(r))!;
  const can = (page: ConsolePage) => pageRoles[page].some(r => roles.includes(r));
  const tenant = tenants.data?.find(row => row.id === orgId);
  const value: Console = {
    me, orgId, role, can, orgLabel: orgName(tenant?.name, i18n.language),
    home: role === 'executive' ? '/admin/dashboard' : '/admin/queue',
  };
  return (
    <ConsoleContext.Provider value={value}>
      <div className="admin-root grid min-h-screen min-w-[1280px] grid-cols-[272px_1fr]">
        {/* The teal column spans the whole page; the rail inside stays pinned while content scrolls. */}
        <div className="bg-sidebar"><Rail /></div>
        <div className="flex min-w-0 flex-col">
          {orgIds.length > 1 && (
            <div className="flex items-center gap-3 border-b bg-secondary px-8 py-2">
              <span className="font-heading text-sm text-secondary-foreground">{t('admin.switchOrg')}</span>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger aria-label={t('admin.switchOrg')} className="h-9 w-72 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{orgIds.map(id => <SelectItem key={id} value={id}>{orgName(tenants.data?.find(row => row.id === id)?.name, i18n.language) || id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </ConsoleContext.Provider>
  );
}

/** Page header: breadcrumb, title, scope chip or actions, and the language switch. */
export function TopBar({ crumbs, title, children }: { crumbs: Array<{ label: string; to?: string }>; title: ReactNode; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center gap-4 border-b bg-card px-8 py-4.5">
      <div className="min-w-0 flex-1">
        <nav aria-label={t('admin.breadcrumb')}>
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {crumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight aria-hidden="true" className="size-4" />}
                {crumb.to ? <Link to={crumb.to} className="text-muted-foreground no-underline hover:text-primary">{crumb.label}</Link> : <span>{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="text-xl leading-[1.35]">{title}</h1>
      </div>
      {children}
      <LanguageToggle tone="light" />
    </header>
  );
}

export function ScopeChip({ children, icon: Icon }: { children: ReactNode; icon: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-heading text-sm font-medium text-secondary-foreground">
      <Icon aria-hidden="true" className="size-4" />{children}
    </span>
  );
}

export function Content({ children, className }: { children: ReactNode; className?: string }) {
  return <main id="main" className={cn('flex flex-col gap-5 px-8 pt-6 pb-10', className)}>{children}</main>;
}

/** In-place Unauthorized for a 403 from the API: role held, role needed, and the logged reference. */
export function DeniedPanel({ page, failure }: { page: ConsolePage; failure?: ApiFailure }) {
  const { t, i18n } = useTranslation();
  const { role, orgLabel, home } = useConsole();
  const navigate = useNavigate();
  const executive = role === 'executive' && (page === 'detail' || page === 'queue');
  const homeLabel = t(home === '/admin/dashboard' ? 'admin.dashboard' : 'admin.queue');
  const [recordedAt] = useState(() => new Date().toISOString());
  return (
    <section aria-labelledby="denied-title" className="mx-auto my-12 flex max-w-160 flex-col items-start gap-5">
      <span aria-hidden="true" className="grid size-18 place-items-center rounded-[20px] bg-danger-soft text-destructive"><ShieldX className="size-9" /></span>
      <h2 id="denied-title" className="text-[1.75rem]">{t(executive ? 'deniedPanel.executiveLead' : 'deniedPanel.genericLead')}</h2>
      <p className="text-[1.0625rem] leading-[1.7]">{t(executive ? 'deniedPanel.executiveBody' : 'deniedPanel.genericBody')}</p>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-[0.9375rem]">
        <dt className="text-muted-foreground">{t('denied.yourRole')}</dt>
        <dd className="font-medium">{t('deniedPanel.heldAt', { role: t(`role.${role}`), org: orgLabel })}</dd>
        <dt className="text-muted-foreground">{t('denied.needs')}</dt>
        <dd className="font-medium">{t(`deniedPanel.needs.${page}`)}</dd>
        {failure && <>
          <dt className="text-muted-foreground">{t('deniedPanel.recorded')}</dt>
          <dd className="font-medium tabular-nums">{time(recordedAt, i18n.language, true)} · {t('errors.reference', { id: failure.requestId })}</dd>
        </>}
      </dl>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => navigate(home)}>{t('deniedPanel.toHome', { page: homeLabel })}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('deniedPanel.askAdmin')}</p>
    </section>
  );
}

export const isDenied = (error: unknown): error is ApiFailure => error instanceof ApiFailure && error.status === 403;
export const isNotFound = (error: unknown): error is ApiFailure => error instanceof ApiFailure && error.status === 404;
