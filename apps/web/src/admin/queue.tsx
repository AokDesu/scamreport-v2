import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Search, Timer } from 'lucide-react';
import type { Report } from '@scamreport/shared';
import { asChannel, asScamType, channelIcon, channels, scamTypes, type ReportStatus } from '@/lib/domain';
import { elapsed, money, ticketLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/status-badge';
import { TicketNumber } from '@/components/ticket';
import { Content, DeniedPanel, isDenied, ScopeChip, TopBar, useConsole, useQueue } from './shell';

type Tab = 'pending' | 'flagged' | 'decided';
const tabStatuses: Record<Tab, ReportStatus[]> = { pending: ['pending'], flagged: ['flagged'], decided: ['verified', 'rejected'] };
const tabCount: Record<Tab, string> = {
  pending: 'bg-status-pending text-status-pending-foreground', flagged: 'bg-status-flagged text-status-flagged-foreground', decided: 'bg-status-withdrawn text-status-withdrawn-foreground',
};
const pageSize = 8;

/** Oldest pending report: the one "Call next" opens. */
export function nextInLine(reports: Report[] | undefined) {
  return reports?.filter(report => report.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export function QueuePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgLabel } = useConsole();
  const queue = useQueue();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(0);
  const reports = useMemo(() => queue.data ?? [], [queue.data]);
  const next = nextInLine(reports);
  const counts = Object.fromEntries((Object.keys(tabStatuses) as Tab[]).map(key => [key, reports.filter(r => tabStatuses[key].includes(r.status)).length])) as Record<Tab, number>;
  const rows = reports
    .filter(r => tabStatuses[tab].includes(r.status))
    .filter(r => type === 'all' || asScamType(r.scam_type) === type)
    .filter(r => channel === 'all' || asChannel(r.channel) === channel)
    .filter(r => !search.trim() || ticketLabel(r.ticket_no, r.created_at).includes(search.trim()) || String(r.ticket_no).includes(search.trim().replace(/^0+/, '')))
    .sort((a, b) => tab === 'decided' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  const filtered = search.trim() || type !== 'all' || channel !== 'all';
  const resetPage = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(0); };

  if (isDenied(queue.error)) return <><TopBar crumbs={[{ label: t('admin.work') }]} title={t('deniedPanel.title')} /><Content><DeniedPanel page="queue" failure={queue.error} /></Content></>;
  return (
    <>
      <TopBar crumbs={[{ label: t('admin.work') }]} title={t('admin.queue')}>
        <ScopeChip icon={Building2}>{t('admin.scope', { org: orgLabel })}</ScopeChip>
      </TopBar>
      <Content>
        <section aria-labelledby="next-label" className="flex items-center gap-5 rounded-xl bg-sidebar px-5 py-4 text-sidebar-foreground">
          <div className="flex flex-col">
            <h2 id="next-label" className="font-heading text-[0.8125rem] font-medium text-sidebar-muted">{t('queue.nextLabel')}</h2>
            {next ? <TicketNumber ticketNo={next.ticket_no} createdAt={next.created_at} size="md" className="text-white" /> : <span className="font-heading text-lg text-white">{t('queue.noneWaiting')}</span>}
          </div>
          {next && <>
            <span aria-hidden="true" className="w-px self-stretch bg-sidebar-border" />
            <div className="min-w-0 flex-1 text-[0.9375rem] leading-normal">
              <p className="font-heading font-semibold text-white">{t(`scamType.${asScamType(next.scam_type)}`)} · {next.amount > 0 ? money(next.amount, i18n.language) : t('ticket.noLoss')}</p>
              <p className="text-sidebar-muted">{t('queue.waited', { time: elapsed(next.created_at, t) })} · {t(next.consent_contact ? 'queue.consent' : 'queue.noConsent')}</p>
            </div>
          </>}
          <Button variant="signal" size="lg" className="ml-auto" disabled={!next} onClick={() => next && navigate(`/admin/reports/${next.id}`)}>
            <ArrowRight aria-hidden="true" />{t('queue.callNext')}
          </Button>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={value => { setTab(value as Tab); setPage(0); }}>
            <TabsList aria-label={t('queue.tabsLabel')} className="h-auto gap-1 rounded-md bg-muted p-1">
              {(Object.keys(tabStatuses) as Tab[]).map(key => (
                <TabsTrigger key={key} value={key} className="min-h-10 cursor-pointer rounded-[9px] px-4 font-heading text-[0.9375rem] data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:shadow-xs">
                  {t(`queue.tabs.${key}`)}
                  <span className={cn('rounded-full px-1.75 font-[Noto_Sans] text-[0.8125rem] leading-[1.4rem] font-bold', tabCount[key])}>{counts[key]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative w-60">
              <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t('queue.searchLabel')} type="search" value={search} onChange={event => resetPage(setSearch)(event.target.value)}
                placeholder={t('queue.searchPlaceholder')} className="h-10 rounded-sm border pl-10 text-[0.9375rem]" />
            </div>
            <Select value={type} onValueChange={resetPage(setType)}>
              <SelectTrigger aria-label={t('queue.typeFilter')} className="h-10 min-w-40 bg-card"><span className="text-muted-foreground">{t('queue.typeFilter')}</span><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('queue.all')}</SelectItem>
                {scamTypes.map(code => <SelectItem key={code} value={code}>{t(`scamType.${code}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={resetPage(setChannel)}>
              <SelectTrigger aria-label={t('queue.channelFilter')} className="h-10 min-w-40 bg-card"><span className="text-muted-foreground">{t('queue.channelFilter')}</span><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('queue.all')}</SelectItem>
                {channels.map(code => <SelectItem key={code} value={code}>{t(`channel.${code}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5faf8] hover:bg-[#f5faf8]">
                <TableHead>{t('queue.col.ticket')}</TableHead>
                <TableHead>{t('queue.col.report')}</TableHead>
                <TableHead>{t('queue.col.channel')}</TableHead>
                <TableHead className="text-right">{t('queue.col.amount')}</TableHead>
                <TableHead>{t(tab === 'decided' ? 'queue.col.received' : 'queue.col.waited')}</TableHead>
                <TableHead>{t('queue.col.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.isPending ? [0, 1, 2].map(key => <TableRow key={key}><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>)
                : queue.isError ? <TableRow><TableCell colSpan={6} role="alert" className="py-8 text-center">{t('errors.network')} <Button variant="link" onClick={() => void queue.refetch()}>{t('app.retry')}</Button></TableCell></TableRow>
                : visible.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{t(filtered ? 'queue.emptyFiltered' : 'queue.empty')}</TableCell></TableRow>
                : visible.map(report => {
                  const Icon = channelIcon[asChannel(report.channel)];
                  const serving = report.id === next?.id;
                  const hours = (Date.now() - new Date(report.created_at).getTime()) / 3600000;
                  return (
                    <TableRow key={report.id} data-serving={serving || undefined} className={cn(serving && 'bg-signal-soft hover:bg-[#fff0c4]')}>
                      <TableCell>
                        <Link to={`/admin/reports/${report.id}`} aria-label={t('queue.open', { ticket: ticketLabel(report.ticket_no, report.created_at) })} className="text-foreground no-underline hover:text-primary">
                          <TicketNumber ticketNo={report.ticket_no} createdAt={report.created_at} size="sm" />
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-90 whitespace-normal">
                        <p className="font-heading text-[0.9375rem] leading-[1.45] font-semibold">{t(`scamType.${asScamType(report.scam_type)}`)}</p>
                        <p className="line-clamp-1 text-sm text-muted-foreground">{report.description}</p>
                      </TableCell>
                      <TableCell><span className="inline-flex items-center gap-1.5"><Icon aria-hidden="true" className="size-4 text-muted-foreground" />{t(`channel.${asChannel(report.channel)}`)}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{report.amount > 0 ? money(report.amount, i18n.language) : t('ticket.noLoss')}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 font-[Noto_Sans,var(--font-sans)] text-sm tabular-nums', tab !== 'decided' && hours >= 4 && 'font-semibold text-status-pending-foreground')}>
                          <Timer aria-hidden="true" className="size-4" />{elapsed(report.created_at, t)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col items-start gap-1">
                          <StatusBadge status={report.status} />
                          {serving && <span className="inline-flex items-center gap-1.5 font-heading text-[0.8125rem] font-semibold text-signal-foreground before:size-2 before:rounded-full before:bg-signal before:shadow-[0_0_0_3px_#f9d98e]">{t('queue.nextForYou')}</span>}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <nav aria-label={t('queue.pagination')} className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{t('queue.showing', { from: current * pageSize + 1, to: current * pageSize + visible.length, total: rows.length })}</span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" />{t('queue.prev')}</Button>
                <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t('queue.next')}<ChevronRight aria-hidden="true" /></Button>
              </span>
            </nav>
          )}
        </div>
      </Content>
    </>
  );
}
