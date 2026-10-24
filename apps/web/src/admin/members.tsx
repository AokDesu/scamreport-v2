import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, Building2, Check, Ellipsis, Lock, UserMinus } from 'lucide-react';
import type { MemberRole, Membership, RosterMember } from '@scamreport/shared';
import { api, failureMessageKey } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/brand';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Content, DeniedPanel, isDenied, ScopeChip, TopBar, useConsole, useRoster } from './shell';

const memberRoles: MemberRole[] = ['moderator', 'org_admin', 'executive'];

function RoleMatrix() {
  const { t } = useTranslation();
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<Record<string, string[]>>('/roles'), staleTime: Infinity });
  const capabilities = [...new Set(memberRoles.flatMap(role => roles.data?.[role] ?? []))].filter(cap => cap !== 'feed:read');
  return (
    <section aria-labelledby="matrix-title" className="flex flex-col gap-4 rounded-xl bg-card px-5.5 py-5 shadow-sm">
      <h2 id="matrix-title" className="text-lg">{t('members.matrix')}</h2>
      {roles.isPending ? <Skeleton className="h-72" /> : (
        <div className="overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--border)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5faf8] hover:bg-[#f5faf8]">
                <TableHead><span className="sr-only">{t('members.capability')}</span></TableHead>
                {memberRoles.map(role => <TableHead key={role} className="px-2 text-center text-[0.8125rem] leading-snug whitespace-normal [word-break:keep-all]">{t(`role.${role}`)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {capabilities.map(cap => (
                <TableRow key={cap}>
                  <TableHead scope="row" className="h-auto py-2.5 text-sm leading-[1.45] font-normal whitespace-normal text-foreground">{t(`members.caps.${cap}`, { nsSeparator: false, defaultValue: t('activity.actions.unknown') })}</TableHead>
                  {memberRoles.map(role => {
                    const allowed = roles.data?.[role]?.includes(cap);
                    return (
                      <TableCell key={role} className="text-center">
                        {allowed ? <Check aria-label={t('members.can')} className="mx-auto size-4.5 text-status-verified-foreground" /> : <Ban aria-label={t('members.cannot')} className="mx-auto size-4.5 text-[#768A7F]" />}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm leading-[1.6] text-muted-foreground">{t('members.matrixNote')}</p>
    </section>
  );
}

export function MembersPage() {
  const { t } = useTranslation();
  const { me, orgId, orgLabel } = useConsole();
  const queryClient = useQueryClient();
  // The admin-only roster call is the access check: a non-admin gets a real, logged 403.
  const memberships = useQuery({ queryKey: ['memberships', orgId], queryFn: () => api<Membership[]>(`/memberships?organization_id=${orgId}`) });
  const roster = useRoster();
  const [removing, setRemoving] = useState<RosterMember | null>(null);
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['memberships', orgId] }), queryClient.invalidateQueries({ queryKey: ['members', orgId] })]);
  const nameOf = (member: RosterMember) => member.display_name || member.email || t('members.unnamed');
  const change = useMutation({
    mutationFn: ({ member, role }: { member: RosterMember; role: MemberRole }) =>
      api<Membership>('/memberships', { method: 'PUT', body: JSON.stringify({ organization_id: orgId, user_id: member.user_id, role }) }),
    onSuccess: (_, { member, role }) => { void refresh(); toast.success(t('members.changed', { name: nameOf(member), role: t(`role.${role}`) })); },
    onError: error => toast.error(t(failureMessageKey(error))),
  });
  const remove = useMutation({
    mutationFn: (member: RosterMember) => api<Membership>('/memberships', { method: 'DELETE', body: JSON.stringify({ organization_id: orgId, user_id: member.user_id }) }),
    onSuccess: (_, member) => { void refresh(); setRemoving(null); toast.success(t('members.removed', { name: nameOf(member) })); },
    onError: error => toast.error(t(failureMessageKey(error))),
  });

  if (isDenied(memberships.error)) return <><TopBar crumbs={[{ label: t('admin.org') }]} title={t('deniedPanel.title')} /><Content><DeniedPanel page="members" failure={memberships.error} /></Content></>;
  const roleOf = (userId: string) => memberships.data?.find(row => row.user_id === userId)?.role;
  const members = (roster.data ?? []).filter(member => roleOf(member.user_id));
  return (
    <>
      <TopBar crumbs={[{ label: t('admin.org') }]} title={t('admin.members')}>
        <ScopeChip icon={Building2}>{t('admin.scopeMembers', { org: orgLabel })}</ScopeChip>
      </TopBar>
      <Content>
        <div className="grid grid-cols-[minmax(0,1fr)_430px] items-start gap-5">
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f5faf8] hover:bg-[#f5faf8]">
                    <TableHead>{t('members.col.member')}</TableHead>
                    <TableHead>{t('members.col.role')}</TableHead>
                    <TableHead className="text-right">{t('members.col.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.isPending || roster.isPending ? [0, 1, 2].map(key => <TableRow key={key}><TableCell colSpan={3}><Skeleton className="h-10" /></TableCell></TableRow>)
                    : memberships.isError || roster.isError ? <TableRow><TableCell colSpan={3} role="alert" className="py-8 text-center">{t('errors.network')}</TableCell></TableRow>
                    : members.map(member => {
                      const self = member.user_id === me.id;
                      const role = roleOf(member.user_id)!;
                      const name = nameOf(member);
                      return (
                        <TableRow key={member.user_id}>
                          <TableCell>
                            <span className="flex items-center gap-3">
                              <Avatar name={name} />
                              <span>
                                <span className="block font-heading text-[0.9375rem] leading-[1.4] font-semibold">{name} {self && <span className="font-normal text-muted-foreground">{t('members.you')}</span>}</span>
                                <span className="block font-[Noto_Sans,var(--font-sans)] text-[0.8125rem] text-muted-foreground">{member.email}</span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            {self ? (
                              <span className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-muted px-3 font-heading text-sm font-medium" title={t('members.selfLocked')}>
                                <Lock aria-hidden="true" className="size-4 text-muted-foreground" />{t(`role.${role}`)}<span className="sr-only">{t('members.selfLocked')}</span>
                              </span>
                            ) : (
                              <Select value={role} disabled={change.isPending} onValueChange={value => change.mutate({ member, role: value as MemberRole })}>
                                <SelectTrigger aria-label={t('members.roleFor', { name })} className="h-10 w-48 bg-card"><SelectValue /></SelectTrigger>
                                <SelectContent>{memberRoles.map(option => <SelectItem key={option} value={option}>{t(`role.${option}`)}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!self && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label={t('members.more', { name })}><Ellipsis aria-hidden="true" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(member)}><UserMinus aria-hidden="true" />{t('members.remove')}</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            <p className={cn('px-1 text-sm text-muted-foreground')}>{t('members.invite')}</p>
          </div>
          <RoleMatrix />
        </div>
      </Content>
      <AlertDialog open={Boolean(removing)} onOpenChange={open => { if (!open && !remove.isPending) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing && t('members.removeTitle', { name: nameOf(removing) })}</AlertDialogTitle>
            <AlertDialogDescription>{t('members.removeBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t('members.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-danger-soft-foreground" disabled={remove.isPending}
              onClick={event => { event.preventDefault(); if (removing) remove.mutate(removing); }}>{t('members.removeConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
