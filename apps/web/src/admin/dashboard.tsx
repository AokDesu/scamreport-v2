import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import type { BreakdownRow, StatisticsRow } from '@scamreport/shared';
import { api } from '@/lib/api';
import { channels, scamTypes, statuses, type ReportStatus } from '@/lib/domain';
import { compactMoney, count, percent, shortDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Content, DeniedPanel, isDenied, TopBar, useConsole } from './shell';

// Status order and colours follow the approved dashboard: verified first, withdrawn neutral.
const statusOrder: ReportStatus[] = ['verified', 'rejected', 'pending', 'withdrawn', 'flagged'];
const statusColor: Record<ReportStatus, string> = {
  verified: 'var(--chart-1)', rejected: 'var(--chart-4)', pending: 'var(--chart-2)', withdrawn: '#7D8F86', flagged: 'var(--chart-5)',
};
const seriesColor = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-4)', '#7D8F86'];

/** Eight Monday-starting weeks ending this week, so empty weeks show as zero instead of disappearing. */
export function lastWeeks(now = new Date(), weeks = 8) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() - 7 * (weeks - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

function Card({ title, titleId, aside, children, className }: { title: string; titleId: string; aside?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={titleId} className={`flex flex-col gap-5 rounded-xl bg-card px-5.5 py-5 shadow-sm ${className ?? ''}`}>
      <h2 id={titleId} className="text-lg">{title}{aside && <small className="ml-3 font-sans text-sm font-normal text-muted-foreground">{aside}</small>}</h2>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { orgId, orgLabel } = useConsole();
  const lng = i18n.language;
  const statistics = useQuery({ queryKey: ['statistics', orgId], queryFn: () => api<StatisticsRow[]>(`/statistics?organization_id=${orgId}`) });
  const breakdown = useQuery({ queryKey: ['breakdown', orgId], queryFn: () => api<BreakdownRow[]>(`/statistics/breakdown?organization_id=${orgId}`), enabled: statistics.isSuccess });

  if (isDenied(statistics.error)) return <><TopBar crumbs={[{ label: t('admin.org') }]} title={t('deniedPanel.title')} /><Content><DeniedPanel page="dashboard" failure={statistics.error} /></Content></>;

  const byStatus = Object.fromEntries(statuses.map(status => [status, statistics.data?.find(row => row.status === status)?.report_count ?? 0])) as Record<ReportStatus, number>;
  const total = statuses.reduce((sum, status) => sum + byStatus[status], 0);
  const loss = statistics.data?.reduce((sum, row) => sum + row.total_amount, 0) ?? 0;
  const rows = breakdown.data ?? [];
  const bucket = (dimension: string, key: string) => rows.find(row => row.dimension === dimension && row.bucket === key)?.report_count ?? 0;
  const consented = bucket('consent', 'true');
  const decided = byStatus.verified + byStatus.rejected;
  const weeks = lastWeeks().map(week => ({ week, label: shortDate(week, lng), received: bucket('week', week), verified: bucket('week_verified', week) }));
  const types = scamTypes.map(type => ({ type, value: bucket('scam_type', type) })).sort((a, b) => b.value - a.value);
  const typeMax = Math.max(1, ...types.map(row => row.value));
  const channelRows = channels.map((channel, index) => ({ channel, value: bucket('channel', channel), color: seriesColor[index]! })).filter(row => row.value > 0);
  const channelTotal = channelRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <TopBar crumbs={[{ label: t('admin.org') }]} title={t('admin.dashboard')} />
      <Content>
        <p className="flex items-center gap-3 rounded-md bg-secondary px-4 py-3 text-[0.9375rem] text-secondary-foreground">
          <ShieldCheck aria-hidden="true" className="size-5 flex-none text-primary" />
          <span><b className="font-heading font-semibold">{t('dashboard.privacy')}</b> · {t('dashboard.privacyBody', { org: orgLabel })}</span>
        </p>
        {statistics.isPending ? <Skeleton role="status" aria-label={t('app.loading')} className="h-72 rounded-xl" /> : statistics.isError ? (
          <p role="alert" className="text-md">{t('errors.network')}</p>
        ) : (
          <div className="grid grid-cols-12 gap-5">
            <Card title={t('dashboard.statusTitle')} titleId="status-title" aside={`${t('dashboard.total', { count: total })} · ${t('dashboard.allTime')}`} className="col-span-12">
              {total === 0 ? <p className="text-muted-foreground">{t('dashboard.empty')}</p> : <>
                <div aria-hidden="true" className="flex h-11 gap-0.75 overflow-hidden rounded-sm">
                  {statusOrder.filter(status => byStatus[status] > 0).map(status => <div key={status} style={{ flexGrow: byStatus[status], background: statusColor[status] }} />)}
                </div>
                <dl className="grid grid-cols-5 gap-4">
                  {statusOrder.map(status => (
                    <div key={status} className="flex flex-col gap-0.5">
                      <dt className="flex items-center gap-1.5 font-heading text-sm font-medium text-muted-foreground">
                        <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: statusColor[status] }} />{t(`status.${status}`)}
                      </dt>
                      <dd className="font-[Noto_Sans] text-[1.75rem] leading-[1.2] font-bold tabular-nums">{count(byStatus[status], lng)}</dd>
                      <dd className="font-[Noto_Sans] text-[0.8125rem] text-muted-foreground">{percent(byStatus[status] / total, lng)}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="flex gap-10 border-t pt-4">
                  {[
                    { label: t('dashboard.totalLoss'), value: compactMoney(loss, lng) },
                    { label: t('dashboard.consentRate'), value: breakdown.isSuccess ? percent(consented / total, lng) : '…' },
                    { label: t('dashboard.verifiedRate'), value: decided ? `${percent(byStatus.verified / decided, lng)} ${t('dashboard.decided')}` : '—' },
                  ].map(figure => (
                    <div key={figure.label} className="flex flex-col">
                      <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                      <dd className="font-[Noto_Sans] text-xl font-semibold tabular-nums">{figure.value}</dd>
                    </div>
                  ))}
                </dl>
              </>}
            </Card>
            <Card title={t('dashboard.weekly')} titleId="weekly-title" aside={t('dashboard.weeklyHint')} className="col-span-7">
              {breakdown.isPending ? <Skeleton className="h-64" /> : <>
                <div role="img" aria-label={`${t('dashboard.weekly')}: ${weeks.map(week => `${week.label} ${week.received}`).join(', ')}`} className="h-64 font-[Noto_Sans] text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeks} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                      <Tooltip formatter={(value, name) => [t('dashboard.reportsCount', { count: Number(value) }), t(`dashboard.${String(name)}`)]}
                        labelFormatter={label => t('dashboard.weekOf', { date: label })}
                        contentStyle={{ borderRadius: 12, border: 0, background: 'var(--foreground)', color: 'white' }} itemStyle={{ color: 'white' }} />
                      <Area type="monotone" dataKey="received" stroke="var(--chart-1)" strokeWidth={2.5} fill="var(--chart-1)" fillOpacity={0.12} isAnimationActive={false} />
                      <Line type="monotone" dataKey="verified" stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex gap-6 text-sm">
                  <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.75 w-5 rounded bg-chart-1" />{t('dashboard.received')}</li>
                  <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.75 w-5 rounded bg-chart-2" />{t('dashboard.verified')}</li>
                </ul>
              </>}
            </Card>
            <Card title={t('dashboard.byType')} titleId="type-title" className="col-span-5">
              {breakdown.isPending ? <Skeleton className="h-48" /> : (
                <dl className="grid grid-cols-[10rem_1fr_3rem] items-center gap-x-3 gap-y-2 text-sm">
                  {types.map(row => (
                    <div key={row.type} className="contents">
                      <dt>{t(`scamType.${row.type}`)}</dt>
                      <dd aria-hidden="true" className="flex h-5 overflow-hidden rounded-[5px] bg-muted"><span className="block h-full bg-chart-1" style={{ width: `${(row.value / typeMax) * 100}%` }} /></dd>
                      <dd className="text-right font-[Noto_Sans] font-semibold tabular-nums">{count(row.value, lng)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <h3 className="mt-2 text-lg" id="channel-title">{t('dashboard.byChannel')}</h3>
              {channelTotal > 0 && <>
                <div aria-hidden="true" className="flex h-8 gap-0.75 overflow-hidden rounded-sm">
                  {channelRows.map(row => <div key={row.channel} style={{ flexGrow: row.value, background: row.color }} />)}
                </div>
                <ul aria-labelledby="channel-title" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {channelRows.map(row => (
                    <li key={row.channel} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: row.color }} />
                      {t(`channel.${row.channel}`)} {percent(row.value / channelTotal, lng)}
                    </li>
                  ))}
                </ul>
              </>}
            </Card>
          </div>
        )}
      </Content>
    </>
  );
}
