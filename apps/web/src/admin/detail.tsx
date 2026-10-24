import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Check, CircleCheck, CircleX, Eye, FileSearch, FileText, Flag, Send, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import type { Contact, ReportDetail, ReportStatus, Tenant } from '@scamreport/shared';
import { api, failureMessageKey } from '@/lib/api';
import { asChannel, asScamType, channelIcon } from '@/lib/domain';
import { dateTime, money, orgName, ticketLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { StatusBadge } from '@/components/status-badge';
import { IdentifierChip, Ticket } from '@/components/ticket';
import { Content, DeniedPanel, isDenied, isNotFound, nextInLineQuery, ReadError, TopBar, useConsole, useRoster } from './shell';

type Decision = Extract<ReportStatus, 'verified' | 'rejected' | 'flagged'>;
const decisions: Array<{ value: Decision; label: string; icon: LucideIcon; tone: string }> = [
  { value: 'verified', label: 'detail.verify', icon: CircleCheck, tone: '[&_svg]:text-status-verified-foreground data-[state=on]:bg-status-verified data-[state=on]:text-status-verified-foreground data-[state=on]:shadow-[inset_0_0_0_2px_var(--status-verified-foreground)]' },
  { value: 'rejected', label: 'detail.reject', icon: CircleX, tone: '[&_svg]:text-status-rejected-foreground data-[state=on]:bg-status-rejected data-[state=on]:text-status-rejected-foreground data-[state=on]:shadow-[inset_0_0_0_2px_var(--status-rejected-foreground)]' },
  { value: 'flagged', label: 'detail.flag', icon: Flag, tone: '[&_svg]:text-status-flagged-foreground data-[state=on]:bg-status-flagged data-[state=on]:text-status-flagged-foreground data-[state=on]:shadow-[inset_0_0_0_2px_var(--status-flagged-foreground)]' },
];

function Panel({ title, titleId, aside, children, className }: { title: string; titleId: string; aside?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-4 rounded-xl bg-card px-5.5 py-5 shadow-sm', className)}>
      <h2 id={titleId} className="text-lg">{title}{aside && <small className="ml-2 font-sans text-sm font-normal text-muted-foreground">{aside}</small>}</h2>
      {children}
    </section>
  );
}

/** Evidence is fetched through the API with the caller's JWT on every read; there is no public URL. */
function EvidenceItem({ reportId, path, index }: { reportId: string; path: string; index: number }) {
  const { t } = useTranslation();
  const filename = path.split('/')[1]!;
  const pdf = filename.endsWith('.pdf');
  const file = useQuery({ queryKey: ['evidence', path], queryFn: () => api<Blob>(`/reports/${reportId}/evidence/${filename}`), staleTime: Infinity });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file.data) return;
    const objectUrl = URL.createObjectURL(file.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file.data]);
  const label = t(pdf ? 'detail.pdfFile' : 'detail.evidenceAlt', { n: index + 1 });
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      {file.isError ? <ReadError error={file.error} onRetry={() => void file.refetch()} /> : <a href={url} target="_blank" rel="noreferrer" aria-label={t('detail.openFile', { name: label })}
        className="block h-46 w-36 overflow-hidden rounded-md bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
        {!url ? <Skeleton className="size-full" />
          : pdf ? <span className="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><FileText aria-hidden="true" className="size-8" />PDF</span>
          : <img src={url} alt={label} className="size-full object-cover" />}
      </a>}
      <figcaption className="text-[0.8125rem] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function ContactPanel({ reportId, consent, orgLabel }: { reportId: string; consent: boolean; orgLabel: string }) {
  const { t } = useTranslation();
  const contact = useMutation({ mutationFn: () => api<Contact>(`/reports/${reportId}/contacts`) });
  return (
    <Panel title={t('detail.reporter')} titleId="reporter-title">
      <p className={cn('flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm leading-normal', consent ? 'bg-status-verified text-status-verified-foreground' : 'bg-status-withdrawn text-status-withdrawn-foreground')}>
        {consent ? <UserCheck aria-hidden="true" className="mt-0.5 size-4.5 flex-none" /> : <UserX aria-hidden="true" className="mt-0.5 size-4.5 flex-none" />}
        {t(consent ? 'detail.consentYes' : 'detail.consentNo', { org: orgLabel })}
      </p>
      {consent && (contact.data ? (
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-[0.9375rem]">
          <dt className="text-muted-foreground">{t('detail.contactEmail')}</dt><dd className="font-medium break-all">{contact.data.email || t('detail.contactNone')}</dd>
          <dt className="text-muted-foreground">{t('detail.contactPhone')}</dt><dd className="font-medium tabular-nums">{contact.data.phone || t('detail.contactNone')}</dd>
        </dl>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <Button variant="outline" onClick={() => contact.mutate()} disabled={contact.isPending}><Eye aria-hidden="true" />{t('detail.showContact')}</Button>
          {contact.isError && <p role="alert" className="text-sm text-destructive">{t(failureMessageKey(contact.error))}</p>}
        </div>
      ))}
    </Panel>
  );
}

/** Keyed by report ID so a fetched contact and an unsaved decision never carry over to another report. */
export function DetailPage() {
  const { id = '' } = useParams();
  return <ReportDetailView key={id} id={id} />;
}

function ReportDetailView({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me } = useConsole();
  const detail = useQuery({ queryKey: ['report', id], queryFn: () => api<ReportDetail>(`/moderation/${id}`) });
  const evidence = useQuery({ queryKey: ['evidence-list', id], queryFn: () => api<Array<{ path: string }>>(`/reports/${id}/evidence`), enabled: detail.isSuccess });
  const roster = useRoster(detail.data?.report.organization_id ?? '');
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: () => api<Tenant[]>('/tenants'), staleTime: 300_000 });
  const [decision, setDecision] = useState<Decision | ''>('');
  const [nextError, setNextError] = useState<Error | null>(null);
  async function callNext(orgId: string) {
    setNextError(null);
    try {
      const following = await queryClient.fetchQuery(nextInLineQuery(orgId));
      if (following && following.id !== id) navigate(`/admin/reports/${following.id}`);
    } catch (error) { setNextError(error as Error); }
  }
  const decide = useMutation({
    mutationFn: (status: Decision) => api(`/moderation/${id}`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: async (_, status) => {
      const report = detail.data!.report;
      toast.success(t('detail.saved', { ticket: ticketLabel(report.ticket_no, report.created_at), status: t(`status.${status}`) }));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['report', id] }), queryClient.invalidateQueries({ queryKey: ['queue'] })]);
      setDecision('');
      await callNext(report.organization_id);
    },
    onError: error => toast.error(t(failureMessageKey(error))),
  });
  const crumbs = [{ label: t('admin.queue'), to: '/admin/queue' }];

  if (isDenied(detail.error)) return <><TopBar crumbs={crumbs} title={t('deniedPanel.title')} /><Content><DeniedPanel page="detail" failure={detail.error} /></Content></>;
  if (isNotFound(detail.error)) return (
    <>
      <TopBar crumbs={crumbs} title={t('detail.notFoundTitle')} />
      <Content>
        <section className="mx-auto my-12 flex max-w-160 flex-col items-start gap-5">
          <span aria-hidden="true" className="grid size-18 place-items-center rounded-[20px] bg-muted text-muted-foreground"><FileSearch className="size-9" /></span>
          <h2 className="text-[1.75rem]">{t('detail.notFoundTitle')}</h2>
          <p className="text-[1.0625rem] leading-[1.7]">{t('detail.notFoundBody')}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{t('errors.reference', { id: detail.error.requestId })}</p>
          <Button asChild size="lg"><Link to="/admin/queue">{t('detail.toQueue')}</Link></Button>
        </section>
      </Content>
    </>
  );
  if (!detail.data) return (
    <>
      <TopBar crumbs={crumbs} title={<Skeleton className="h-8 w-80" />} />
      <Content>{detail.isError
        ? <p role="alert" className="text-md">{t(failureMessageKey(detail.error))} <Button variant="link" onClick={() => void detail.refetch()}>{t('app.retry')}</Button></p>
        : <Skeleton role="status" aria-label={t('app.loading')} className="h-96 rounded-xl" />}</Content>
    </>
  );

  const { report, history } = detail.data;
  const orgLabel = orgName(tenants.data?.find(tenant => tenant.id === report.organization_id)?.name, i18n.language);
  const type = asScamType(report.scam_type);
  const channel = asChannel(report.channel);
  const ticket = ticketLabel(report.ticket_no, report.created_at);
  const open = report.status === 'pending' || report.status === 'flagged';
  const canDecide = me.memberships.some(m => m.organization_id === report.organization_id && m.role === 'moderator');
  const nameOf = (userId: string) => userId === me.id ? t('admin.you') : roster.data?.find(member => member.user_id === userId)?.display_name || t('detail.staff');
  const files = evidence.data ?? [];

  return (
    <>
      <TopBar crumbs={[...crumbs, { label: ticket }]} title={<>{t(`scamType.${type}`)} · {report.amount > 0 ? money(report.amount, i18n.language) : t('ticket.noLoss')}</>}>
        <Button asChild variant="ghost" size="sm"><Link to="/admin/queue"><ArrowLeft aria-hidden="true" />{t('detail.back')}</Link></Button>
        <StatusBadge status={report.status} />
      </TopBar>
      <Content>
        <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5">
          <div className="flex flex-col gap-5">
            <Ticket ticketNo={report.ticket_no} createdAt={report.created_at} tear="6rem" labelledBy="ticket-story"
              badge={
                <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 pt-1 text-sm">
                  <dt className="text-muted-foreground">{t('detail.received')}</dt><dd className="tabular-nums">{dateTime(report.created_at, i18n.language)}</dd>
                  <dt className="text-muted-foreground">{t('detail.routedBecause')}</dt><dd>{t('detail.routedValue', { org: orgLabel })}</dd>
                </dl>
              }>
              <dl className="grid grid-cols-[9rem_1fr] items-center gap-x-4 gap-y-2.5 text-[0.9375rem]">
                <dt className="text-muted-foreground">{t('detail.type')}</dt><dd className="font-medium">{t(`scamType.${type}`)}</dd>
                <dt className="text-muted-foreground">{t('detail.channel')}</dt>
                <dd><IdentifierChip icon={channelIcon[channel]} className="text-[0.9375rem]">{t(`channel.${channel}`)}</IdentifierChip></dd>
                <dt className="text-muted-foreground">{t('detail.amount')}</dt><dd className="font-medium tabular-nums">{report.amount > 0 ? money(report.amount, i18n.language) : t('ticket.noLoss')}</dd>
              </dl>
              <h3 id="ticket-story" className="mt-2 text-base">{t('detail.story')}</h3>
              <p className="max-w-[65ch] text-base leading-[1.7] whitespace-pre-line">{report.description}</p>
              <h3 className="mt-2 text-base">{t('detail.evidence')} {files.length > 0 && <small className="font-sans text-sm font-normal text-muted-foreground">{t('detail.evidenceCount', { count: files.length })}</small>}</h3>
              {evidence.isPending ? <Skeleton className="h-46 w-36" /> : evidence.isError ? <ReadError error={evidence.error} onRetry={() => void evidence.refetch()} /> : files.length === 0
                ? <p className="text-[0.9375rem] text-muted-foreground">{t('detail.noEvidence')}</p>
                : <div className="flex flex-wrap gap-3.5">{files.map((file, index) => <EvidenceItem key={file.path} reportId={report.id} path={file.path} index={index} />)}</div>}
            </Ticket>
            <ContactPanel reportId={report.id} consent={report.consent_contact} orgLabel={orgLabel} />
          </div>
          <div className="flex flex-col gap-5">
            <Panel title={t('detail.decide')} titleId="decide-title">
              {nextError && <ReadError error={nextError} onRetry={() => void callNext(report.organization_id)} />}
              {!open ? <p className="text-[0.9375rem]">{t('detail.decidedAlready', { status: t(`status.${report.status}`) })}</p>
                : !canDecide ? <p className="text-[0.9375rem] text-muted-foreground">{t('detail.adminReadOnly')}</p>
                : <>
                  <ToggleGroup type="single" aria-labelledby="decide-title" value={decision} onValueChange={value => setDecision(value as Decision | '')} className="grid w-full grid-cols-3 gap-2" spacing={2}>
                    {decisions.filter(option => !(report.status === 'flagged' && option.value === 'flagged')).map(option => (
                      <ToggleGroupItem key={option.value} value={option.value}
                        className={cn('flex h-auto min-h-18 cursor-pointer flex-col gap-1 rounded-md bg-card px-2 py-3 font-heading text-[0.9375rem] font-semibold text-foreground shadow-[inset_0_0_0_1.5px_var(--border)] hover:bg-muted', option.tone)}>
                        <option.icon aria-hidden="true" className="size-6" />{t(option.label)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Button size="lg" disabled={!decision || decide.isPending} onClick={() => decision && decide.mutate(decision)}>
                    {decide.isPending ? t('detail.saving') : <><Check aria-hidden="true" />{t('detail.saveAndNext')}</>}
                  </Button>
                </>}
            </Panel>
            <Panel title={t('detail.history')} titleId="history-title">
              <ol className="timeline flex flex-col">
                {[...history].reverse().map(entry => (
                  <li key={entry.request_id + entry.created_at} className="grid grid-cols-[1.75rem_1fr] gap-3 pb-4">
                    <span aria-hidden="true" className={cn('grid size-7 place-items-center rounded-full', entry.to_status === 'flagged' ? 'bg-status-flagged text-status-flagged-foreground' : 'bg-secondary text-primary')}>
                      {entry.to_status === 'verified' ? <CircleCheck className="size-3.75" /> : entry.to_status === 'rejected' ? <CircleX className="size-3.75" /> : <Flag className="size-3.75" />}
                    </span>
                    <div>
                      <p className="font-heading text-[0.9375rem] leading-[1.45] font-semibold">{t('detail.historyDecision', { actor: nameOf(entry.actor_id) })}</p>
                      <p className="text-sm text-muted-foreground">{t('detail.historyTransition', { from: t(`status.${entry.from_status}`), to: t(`status.${entry.to_status}`) })}</p>
                      <p className="font-[Noto_Sans] text-[0.8125rem] text-muted-foreground tabular-nums">{dateTime(entry.created_at, i18n.language)} · {t('detail.requestId', { id: entry.request_id.slice(0, 13) })}</p>
                    </div>
                  </li>
                ))}
                <li className="grid grid-cols-[1.75rem_1fr] gap-3">
                  <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground"><Send className="size-3.75" /></span>
                  <div>
                    <p className="font-heading text-[0.9375rem] leading-[1.45] font-semibold">{t('detail.historySubmitted')}</p>
                    <p className="text-sm text-muted-foreground">{t('detail.historySubmittedNote')} · {t(report.consent_contact ? 'detail.historyConsent' : 'detail.historyNoConsent')}</p>
                    <p className="font-[Noto_Sans] text-[0.8125rem] text-muted-foreground tabular-nums">{dateTime(report.created_at, i18n.language)}</p>
                  </div>
                </li>
              </ol>
            </Panel>
          </div>
        </div>
      </Content>
    </>
  );
}
