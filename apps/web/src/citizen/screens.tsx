import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Bell, Building2, CalendarDays, CircleCheck, Hourglass, LogOut, Paperclip, Plus, Search, SearchX, Undo2, UserCheck, UserX } from 'lucide-react';
import type { FeedItem, Report, Tenant } from '@scamreport/shared';
import i18next from 'i18next';
import { api, ApiFailure, failureMessageKey } from '@/lib/api';
import { useIdentity } from '@/auth/identity';
import { asChannel, asScamType, channelIcon, channels, scamTypes, type Channel, type ScamType } from '@/lib/domain';
import { date, money, orgName, ticketLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { StepTrack } from '@/components/step-track';
import { IdentifierChip, Ticket } from '@/components/ticket';
import { BottomNav, CitizenBody, CitizenHeader } from './shell';

function useTenantNames() {
  const { i18n } = useTranslation();
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<Tenant[]>('/tenants'), staleTime: 300_000 });
  return (id: string) => orgName(tenants.data?.find(tenant => tenant.id === id)?.name, i18n.language);
}

function ListSkeleton() {
  return <div role="status" aria-label={i18next.t('app.loading')} className="flex flex-col gap-4">{[0, 1].map(key => <Skeleton key={key} className="h-48 rounded-xl bg-card" />)}</div>;
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 text-center shadow-sm">
      <p className="text-md">{t(failureMessageKey(error))}</p>
      <Button variant="outline" onClick={onRetry}>{t('app.retry')}</Button>
    </div>
  );
}

/** Feed search works on translated labels: "ลงทุน" or "LINE" finds the matching type or channel codes. */
export function matchFeedCodes(query: string, label: (key: string, language: string) => string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches = (key: string, code: string) => code.includes(needle) || ['th', 'en'].some(language => label(key, language).toLowerCase().includes(needle));
  return [
    ...scamTypes.filter(code => matches(`scamType.${code}`, code)),
    ...channels.filter(code => matches(`channel.${code}`, code)),
  ].filter((code, index, list) => list.indexOf(code) === index);
}

export function Feed() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const search = query.trim();
  const codes = useMemo(() => matchFeedCodes(search, (key, lng) => i18n.getFixedT(lng)(key)), [search, i18n]);
  const feed = useQuery({
    queryKey: ['feed', search ? codes : null],
    queryFn: async () => {
      if (!search) return api<FeedItem[]>('/feed?limit=50');
      const pages = await Promise.all(codes.map(code => api<FeedItem[]>(`/feed?limit=50&search=${encodeURIComponent(code)}`)));
      const unique = new Map(pages.flat().map(item => [item.id, item]));
      return [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });
  const items = feed.data ?? [];
  return (
    <>
      <CitizenHeader title={t('feed.title')} subtitle={t('feed.lead')} />
      <CitizenBody>
        <search className="relative">
          <label htmlFor="feed-search" className="sr-only">{t('feed.searchLabel')}</label>
          <Search aria-hidden="true" className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <Input id="feed-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('feed.searchPlaceholder')}
            className="h-15 rounded-lg border-transparent pl-13 shadow-md" />
        </search>
        <p aria-live="polite" className="px-1 text-[0.9375rem] text-muted-foreground">
          {feed.isSuccess && items.length > 0 && t(search ? 'feed.results' : 'feed.latest', { count: items.length })}
        </p>
        {feed.isPending ? <ListSkeleton /> : feed.isError ? <LoadError error={feed.error} onRetry={() => void feed.refetch()} /> : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-8 text-center shadow-sm">
            <SearchX aria-hidden="true" className="size-10 text-muted-foreground" />
            <h2 className="text-lg">{t(search ? 'feed.emptyTitle' : 'feed.noneYet')}</h2>
            <p className="text-base text-muted-foreground">{t('feed.emptyBody')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/citizen/report"><Plus aria-hidden="true" />{t('feed.emptyAction')}</Link></Button>
              {search && <Button variant="outline" onClick={() => setQuery('')}>{t('feed.clear')}</Button>}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4" aria-label={t('feed.title')}>
            {items.map(item => {
              const type: ScamType = asScamType(item.scam_type);
              const channel: Channel = asChannel(item.channel);
              return (
                <li key={item.id} className="flex flex-col gap-2.5 rounded-xl bg-card px-5 py-4.5 shadow-sm">
                  <StatusBadge status="verified" audience="citizen" className="self-start" />
                  <h2 className="text-[1.1875rem] leading-[1.45]">{t(`scamType.${type}`)}</h2>
                  <IdentifierChip icon={channelIcon[channel]}>{t('feed.via')} {t(`channel.${channel}`)}</IdentifierChip>
                  <p className="text-base leading-[1.6]"><b className="font-heading font-semibold">{t('feed.tipLabel')}</b> {t(`feed.tips.${type}`)}</p>
                  <p className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[0.9375rem] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4" />{t('feed.reportedOn', { date: date(item.created_at, i18n.language) })}</span>
                    <span>{item.amount > 0 ? t('feed.lost', { amount: money(item.amount, i18n.language) }) : t('feed.noLoss')}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CitizenBody>
      <BottomNav />
    </>
  );
}

function ReportNote({ report }: { report: Report }) {
  const { t } = useTranslation();
  const note = { verified: 'reports.verifiedNote', rejected: 'reports.rejectedNote', flagged: 'reports.flaggedNote', withdrawn: 'reports.withdrawnNote', pending: null }[report.status];
  return note ? <p className="text-base leading-[1.6]">{t(note)}</p> : null;
}

function ReportTicket({ report, onWithdraw }: { report: Report; onWithdraw: (report: Report) => void }) {
  const { t, i18n } = useTranslation();
  const tenantName = useTenantNames();
  const type = asScamType(report.scam_type);
  const titleId = `report-${report.id}`;
  return (
    <Ticket ticketNo={report.ticket_no} createdAt={report.created_at} labelledBy={titleId} badge={<StatusBadge status={report.status} audience="citizen" />}>
      <h2 id={titleId} className="text-[1.1875rem] leading-[1.45]">
        {t(`scamType.${type}`)}
        <span className="block font-sans text-base font-normal text-muted-foreground">
          {t(`channel.${asChannel(report.channel)}`)} · {report.amount > 0 ? t('ticket.amount', { amount: money(report.amount, i18n.language) }) : t('ticket.noLoss')}
        </span>
      </h2>
      {report.status !== 'withdrawn' && <StepTrack status={report.status} />}
      <ReportNote report={report} />
      <p className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[0.9375rem] leading-[1.55] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4" />{t('reports.sentOn', { date: date(report.created_at, i18n.language) })}</span>
        <span className="inline-flex items-center gap-1.5"><Building2 aria-hidden="true" className="size-4" />{tenantName(report.organization_id)}</span>
        <span className="inline-flex items-center gap-1.5">
          {report.consent_contact ? <UserCheck aria-hidden="true" className="size-4" /> : <UserX aria-hidden="true" className="size-4" />}
          {t(report.consent_contact ? 'reports.consented' : 'reports.anonymous')}
        </span>
      </p>
      {(report.status === 'pending' || report.status === 'flagged') && (
        <Button variant="destructive-outline" size="lg" className="mt-1" onClick={() => onWithdraw(report)}>
          <Undo2 aria-hidden="true" />{t('reports.withdraw')}
        </Button>
      )}
    </Ticket>
  );
}

export function MyReports() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { signOut } = useIdentity();
  const reports = useQuery({ queryKey: ['reports'], queryFn: () => api<Report[]>('/reports?limit=100') });
  const [withdrawing, setWithdrawing] = useState<Report | null>(null);
  const withdraw = useMutation({
    mutationFn: (report: Report) => api<Report>(`/reports/${report.id}/withdraw`, { method: 'POST' }),
    onSuccess: report => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      toast.success(t('reports.withdrawn', { ticket: ticketLabel(report.ticket_no, report.created_at) }));
      setWithdrawing(null);
    },
    onError: error => toast.error(t(failureMessageKey(error))),
  });
  const list = reports.data ?? [];
  const open = list.filter(report => report.status === 'pending' || report.status === 'flagged').length;
  const ticket = withdrawing ? ticketLabel(withdrawing.ticket_no, withdrawing.created_at) : '';
  return (
    <>
      <CitizenHeader title={t('reports.title')} subtitle={reports.isSuccess ? t('reports.summary', { total: list.length, open }) : undefined} />
      <CitizenBody>
        {reports.isPending ? <ListSkeleton /> : reports.isError ? <LoadError error={reports.error} onRetry={() => void reports.refetch()} /> : list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-8 text-center shadow-sm">
            <h2 className="text-lg">{t('reports.empty')}</h2>
            <p className="text-base text-muted-foreground">{t('reports.emptyHint')}</p>
            <Button asChild size="lg"><Link to="/citizen/report"><Plus aria-hidden="true" />{t('reports.start')}</Link></Button>
          </div>
        ) : list.map(report => <ReportTicket key={report.id} report={report} onWithdraw={setWithdrawing} />)}
        <Button variant="ghost" size="lg" className="mt-2 self-center" onClick={async () => { if (await signOut()) navigate('/sign-in', { replace: true }); }}>
          <LogOut aria-hidden="true" />{t('nav.signOut')}
        </Button>
      </CitizenBody>
      <BottomNav />
      <Sheet open={Boolean(withdrawing)} onOpenChange={value => { if (!value && !withdraw.isPending) setWithdrawing(null); }}>
        <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-w-[390px] gap-4 rounded-t-2xl border-0 bg-card px-5 pt-3 pb-6">
          <span aria-hidden="true" className="mx-auto mb-1 h-1.25 w-12 rounded-full bg-border" />
          <SheetTitle className="font-heading text-[1.375rem] font-semibold">{t('reports.withdrawTitle', { ticket })}</SheetTitle>
          <SheetDescription className="text-md leading-[1.7] text-foreground">{t('reports.withdrawBody')}</SheetDescription>
          <Button variant="destructive" size="lg" disabled={withdraw.isPending} onClick={() => withdrawing && withdraw.mutate(withdrawing)}>{t('reports.withdrawConfirm')}</Button>
          <Button variant="outline" size="lg" disabled={withdraw.isPending} onClick={() => setWithdrawing(null)}>{t('reports.withdrawKeep')}</Button>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function Submitted() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const state = useLocation().state as { report?: Report; attached?: number } | null;
  const received = state?.report?.id === id ? state?.report : undefined;
  const fetched = useQuery({
    queryKey: ['reports', id], queryFn: () => api<Report>(`/reports/${id}`), enabled: !received,
  });
  const report = received ?? fetched.data;
  const missing = fetched.error instanceof ApiFailure && fetched.error.status === 404;
  const tenantName = useTenantNames();
  return (
    <>
      <CitizenHeader title={t(missing ? 'notFound.title' : 'submitted.title')} subtitle={t(missing ? 'submitted.notFound' : 'submitted.lead')} />
      <CitizenBody className="pb-10">
        {!report ? (missing ? <p role="alert">{t('submitted.notFound')}</p> : fetched.isError ? <LoadError error={fetched.error} onRetry={() => void fetched.refetch()} /> : <ListSkeleton />) : (
          <div>
            <div aria-hidden="true" className="print-slot mx-1" />
            <div className="-mt-1.25 overflow-hidden px-1 pb-4.5">
              <div className="print-out">
                <Ticket ticketNo={report.ticket_no} createdAt={report.created_at} labelledBy="submitted-title" badge={<StatusBadge status={report.status} audience="citizen" />}>
                  <h2 id="submitted-title" className="text-[1.1875rem] leading-[1.45]">
                    {t(`scamType.${asScamType(report.scam_type)}`)}
                    <span className="block font-sans text-base font-normal text-muted-foreground">
                      {t(`channel.${asChannel(report.channel)}`)} · {report.amount > 0 ? t('ticket.amount', { amount: money(report.amount, i18n.language) }) : t('ticket.noLoss')}
                    </span>
                  </h2>
                  <StepTrack status={report.status} />
                  <p className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[0.9375rem] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Building2 aria-hidden="true" className="size-4" />{tenantName(report.organization_id)}</span>
                    <span className="inline-flex items-center gap-1.5"><Hourglass aria-hidden="true" className="size-4" />{t('submitted.eta')}</span>
                    {(state?.attached ?? 0) > 0 && <span className="inline-flex items-center gap-1.5"><Paperclip aria-hidden="true" className="size-4" />{t('submitted.evidence', { count: state!.attached })}</span>}
                  </p>
                </Ticket>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 rounded-lg bg-card p-4 text-base leading-[1.6] shadow-xs">
          <Bell aria-hidden="true" className="mt-0.5 size-5 flex-none text-primary" />
          <p>{t('submitted.notify')}</p>
        </div>
        <Button asChild size="lg"><Link to="/citizen/reports"><CircleCheck aria-hidden="true" />{t('submitted.toReports')}</Link></Button>
        <Button asChild size="lg" variant="ghost" className={cn('text-md')}><Link to="/citizen/feed">{t('submitted.toFeed')}</Link></Button>
      </CitizenBody>
    </>
  );
}
