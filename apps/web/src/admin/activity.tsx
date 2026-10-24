import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, ChevronLeft, ChevronRight, CircleCheck, Copy, LockKeyhole, Search, Smartphone, Timer, UserX } from 'lucide-react';
import type { AuditCounts, AuditEntry, RosterMember } from '@scamreport/shared';
import { api } from '@/lib/api';
import { date, time } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TicketNumber } from '@/components/ticket';
import { Content, DeniedPanel, isDenied, ScopeChip, TopBar, useConsole, useRoster } from './shell';

const pageSize = 20;
type ResultFilter = 'all' | 'success' | 'denied';

export function ActivityPage() {
  const { t, i18n } = useTranslation();
  const { orgId } = useConsole();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ResultFilter>('all');
  const [search, setSearch] = useState('');
  const audit = useQuery({
    queryKey: ['audit', orgId, result, page],
    queryFn: () => api<AuditEntry[]>(`/audit?organization_id=${orgId}&limit=${pageSize}&offset=${page * pageSize}${result === 'all' ? '' : `&result=${result}`}`),
  });
  const counts = useQuery({
    queryKey: ['audit-counts', orgId], queryFn: () => api<AuditCounts>(`/audit/counts?organization_id=${orgId}`), enabled: audit.isSuccess,
  });
  const roster = useRoster();
  const member = (userId: string | null) => roster.data?.find(row => row.user_id === userId);

  if (isDenied(audit.error)) return <><TopBar crumbs={[{ label: t('admin.work') }]} title={t('deniedPanel.title')} /><Content><DeniedPanel page="activity" failure={audit.error} /></Content></>;

  const entries = audit.data ?? [];
  const actionLabel = (action: string) => t(`activity.actions.${action}`, { defaultValue: t('activity.actions.unknown') });
  const memberName = (row: RosterMember) => row.display_name || row.email || t('members.unnamed');
  const isReporter = (entry: AuditEntry) => entry.action === 'reports.insert' || (entry.action === 'reports.update' && !entry.is_moderation);
  const actorName = (entry: AuditEntry) => {
    if (entry.actor_id === null) return t('activity.system');
    if (isReporter(entry)) return t('activity.reporter');
    const row = member(entry.actor_id);
    return row ? memberName(row) : t('activity.formerMember');
  };
  const target = (entry: AuditEntry) => entry.ticket_no !== null ? null
    : entry.action.startsWith('memberships.') ? (member(entry.resource_id) ? memberName(member(entry.resource_id)!) : t('activity.formerMember'))
    : entry.action.startsWith('denied.') ? t(entry.resource_id === orgId ? 'activity.organization' : 'activity.otherOrganization')
    : '—';
  const needle = search.trim().toLowerCase();
  const rows = entries
    .filter(entry => !needle || [actorName(entry), actionLabel(entry.action), entry.request_id, String(entry.ticket_no ?? ''), target(entry) ?? ''].some(text => text.toLowerCase().includes(needle)));

  return (
    <>
      <TopBar crumbs={[{ label: t('admin.work') }]} title={t('admin.activity')}>
        <ScopeChip icon={LockKeyhole}>{t('activity.retention')}</ScopeChip>
      </TopBar>
      <Content>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t('activity.searchLabel')} type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder={t('activity.searchPlaceholder')} className="h-10 rounded-sm border pl-10 text-[0.9375rem]" />
          </div>
          <Select value={result} onValueChange={value => { setResult(value as ResultFilter); setPage(0); }}>
            <SelectTrigger aria-label={t('activity.resultFilter')} className="h-10 min-w-44 bg-card"><span className="text-muted-foreground">{t('activity.resultFilter')}</span><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['all', 'success', 'denied'] as const).map(value => <SelectItem key={value} value={value}>{t(`activity.${value}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p aria-live="polite" className="ml-auto text-[0.9375rem] text-muted-foreground">{audit.isSuccess && counts.isSuccess && t('activity.summary', { shown: entries.length, denied: counts.data.denied })}</p>
        </div>
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5faf8] hover:bg-[#f5faf8]">
                <TableHead>{t('activity.col.time')}</TableHead>
                <TableHead>{t('activity.col.actor')}</TableHead>
                <TableHead>{t('activity.col.action')}</TableHead>
                <TableHead>{t('activity.col.target')}</TableHead>
                <TableHead>{t('activity.col.result')}</TableHead>
                <TableHead>{t('activity.col.request')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.isPending ? [0, 1, 2, 3].map(key => <TableRow key={key}><TableCell colSpan={6}><Skeleton className="h-9" /></TableCell></TableRow>)
                : audit.isError ? <TableRow><TableCell colSpan={6} role="alert" className="py-8 text-center">{t('errors.network')} <Button variant="link" onClick={() => void audit.refetch()}>{t('app.retry')}</Button></TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{t(entries.length || result !== 'all' ? 'activity.emptyFiltered' : 'activity.empty')}</TableCell></TableRow>
                : rows.map(entry => {
                  const denied = entry.action.startsWith('denied.');
                  const actor = isReporter(entry) ? undefined : member(entry.actor_id);
                  const name = actorName(entry);
                  const targetText = target(entry);
                  return (
                    <TableRow key={entry.id} data-denied={denied || undefined} className={cn(denied && 'bg-[#fdf6f5] hover:bg-[#fbeeec]')}>
                      <TableCell className="font-[Noto_Sans] text-sm tabular-nums">
                        <span className="block">{time(entry.created_at, i18n.language, true)}</span>
                        <span className="block text-[0.8125rem] text-muted-foreground">{date(entry.created_at, i18n.language)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2.5">
                          {entry.actor_id === null ? <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-muted"><Timer className="size-4 text-muted-foreground" /></span>
                            : actor ? <Avatar name={name} className="size-8 text-[0.8125rem]" />
                            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-muted">{isReporter(entry) ? <Smartphone className="size-4 text-muted-foreground" /> : <UserX className="size-4 text-muted-foreground" />}</span>}
                          <span>
                            <span className="block font-heading text-[0.9375rem] leading-[1.4] font-semibold">{name}</span>
                            <span className="block text-[0.8125rem] text-muted-foreground">{actor ? t(`role.${actor.role}`) : entry.actor_id === null ? t('activity.automatic') : ''}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">{actionLabel(entry.action)}</TableCell>
                      <TableCell>{targetText ?? <TicketNumber ticketNo={entry.ticket_no!} createdAt={entry.report_created_at!} size="sm" className="text-base" />}</TableCell>
                      <TableCell>
                        {denied
                          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-status-rejected px-3 py-0.5 font-heading text-sm font-semibold text-status-rejected-foreground"><Ban aria-hidden="true" className="size-4" />{t('activity.deniedBadge')}</span>
                          : <span className="inline-flex items-center gap-1.5 rounded-full bg-status-verified px-3 py-0.5 font-heading text-sm font-semibold text-status-verified-foreground"><CircleCheck aria-hidden="true" className="size-4" />{t('activity.success')}</span>}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <code className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem]" title={entry.request_id}>{entry.request_id.slice(0, 18)}{entry.request_id.length > 18 ? '…' : ''}</code>
                          <Button variant="ghost" size="icon-sm" aria-label={t('activity.copy', { id: entry.request_id })}
                            onClick={() => void navigator.clipboard?.writeText(entry.request_id).then(() => toast(t('activity.copied')))}>
                            <Copy aria-hidden="true" className="size-4" />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          <nav aria-label={t('queue.pagination')} className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>{t('activity.page', { n: page + 1 })}</span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden="true" />{t('activity.prev')}</Button>
              <Button variant="outline" size="sm" disabled={entries.length < pageSize} onClick={() => setPage(page + 1)}>{t('activity.next')}<ChevronRight aria-hidden="true" /></Button>
            </span>
          </nav>
        </div>
      </Content>
    </>
  );
}
