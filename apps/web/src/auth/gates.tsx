import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Eye, EyeOff, Home, LockKeyhole, LogIn, ShieldX, Timer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { lastAccount, returnPath, sessionEnd } from '@/lib/session';
import { drafts } from '@/lib/draft';
import { homePath, primaryRole } from '@/lib/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/brand';
import { GateLayout, MobileFrame } from '@/citizen/shell';
import { useIdentity } from './identity';

function PasswordField({ id, disabled }: { id: string; disabled: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('signIn.password')}</Label>
      <div className="relative flex items-center">
        <Input id={id} name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required disabled={disabled}
          placeholder={t('signIn.passwordPlaceholder')} className="pr-28" />
        <Button type="button" variant="ghost" size="sm" className="absolute right-1.5" aria-label={t(visible ? 'signIn.hidePassword' : 'signIn.showPassword')}
          aria-pressed={visible} onClick={() => setVisible(value => !value)}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}<span aria-hidden="true">{t(visible ? 'signIn.hide' : 'signIn.show')}</span>
        </Button>
      </div>
    </div>
  );
}

function useSignIn() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();
    setBusy(true); setFailed(false);
    const form = new FormData(event.currentTarget);
    try {
      sessionEnd.expected = false;
      const { error } = await supabase.auth.signInWithPassword({ email, password: String(form.get('password')) });
      setFailed(Boolean(error));
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return { busy, failed, submit };
}

function useSignedInRedirect() {
  const { me, pending } = useIdentity();
  const [target] = useState(() => returnPath.take());
  if (pending || !me) return null;
  // Continue where the session ended, but only inside this account's own area.
  const area = primaryRole(me) === 'citizen' ? '/citizen' : '/admin';
  return target?.startsWith(area) ? target : homePath(me);
}

export function SignIn() {
  const { t } = useTranslation();
  const redirect = useSignedInRedirect();
  const { busy, failed, submit } = useSignIn();
  const [email, setEmail] = useState('');
  const errorId = useId();
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <GateLayout title={t('signIn.title')} lead={t('signIn.lead')}>
      <form className="flex flex-col gap-4.5" onSubmit={event => void submit(event, email)} aria-busy={busy} aria-describedby={failed ? errorId : undefined}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sign-in-email">{t('signIn.email')}</Label>
          <Input id="sign-in-email" name="email" type="email" autoComplete="username" inputMode="email" required disabled={busy}
            placeholder={t('signIn.emailPlaceholder')} value={email} onChange={event => setEmail(event.target.value)} />
        </div>
        <PasswordField id="sign-in-password" disabled={busy} />
        {failed && <p id={errorId} role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-base text-danger-soft-foreground">{t('signIn.failed')}</p>}
        <Button type="submit" size="lg" disabled={busy}><LogIn aria-hidden="true" />{t(busy ? 'signIn.busy' : 'signIn.submit')}</Button>
      </form>
      <div className="flex items-start gap-3 rounded-lg bg-card p-4 text-base leading-[1.6] shadow-xs">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 flex-none text-primary" />
        <p>{t('signIn.otpWarning')}</p>
      </div>
      <p className="text-center text-sm text-muted-foreground">{t('signIn.staffNote')}</p>
    </GateLayout>
  );
}

export function SessionExpired() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const redirect = useSignedInRedirect();
  const { busy, failed, submit } = useSignIn();
  const [account] = useState(() => lastAccount.get());
  const email = account?.email ?? '';
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    if (account) void drafts.load(account.id).then(draft => setHasDraft(Boolean(draft)));
  }, [account]);
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <GateLayout icon={Timer} title={t('expired.title')} lead={t('expired.lead')}>
      <div role="status" className="flex items-start gap-3 rounded-lg bg-card p-4 text-base leading-[1.6] shadow-xs">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 flex-none text-primary" />
        <p>{t(hasDraft ? 'expired.draftSaved' : 'expired.noDraft')}</p>
      </div>
      <form className="flex flex-col gap-4.5" onSubmit={event => void submit(event, email)} aria-busy={busy}>
        {email && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expired-email">{t('expired.account')}</Label>
            <Input id="expired-email" type="email" autoComplete="username" value={email} readOnly />
          </div>
        )}
        <PasswordField id="expired-password" disabled={busy || !email} />
        {failed && <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-base text-danger-soft-foreground">{t('signIn.failed')}</p>}
        <Button type="submit" size="lg" disabled={busy || !email}><LogIn aria-hidden="true" />{t(busy ? 'signIn.busy' : 'expired.submit')}</Button>
      </form>
      <Button variant="ghost" size="lg" onClick={() => { lastAccount.clear(); navigate('/sign-in'); }}>{t('expired.other')}</Button>
    </GateLayout>
  );
}

export type DeniedState = { need?: 'moderator' | 'citizen'; requestId?: string };

/** Citizen-facing Unauthorized: the role held against the role this page needs. */
export function Unauthorized() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, pending, signOut } = useIdentity();
  const state = (useLocation().state ?? {}) as DeniedState;
  if (pending) return <LoadingScreen />;
  if (!me) return <Navigate to="/sign-in" replace />;
  const held = primaryRole(me);
  const need = state.need ?? (held === 'citizen' ? 'moderator' : 'citizen');
  const citizenView = need === 'moderator';
  return (
    <GateLayout icon={ShieldX} iconTone="danger" title={t(citizenView ? 'denied.citizenTitle' : 'denied.staffTitle')} lead={t(citizenView ? 'denied.citizenLead' : 'denied.staffLead')}>
      <section aria-label={t('denied.yourRole')} className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={me.email ?? '?'} className="size-12" />
          <p className="min-w-0 font-[Noto_Sans,var(--font-sans)] text-base break-all text-muted-foreground">{me.email}</p>
        </div>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-base">
          <dt className="text-muted-foreground">{t('denied.yourRole')}</dt>
          <dd className="font-heading font-semibold">{t(`role.${held}`)}</dd>
          <dt className="text-muted-foreground">{t('denied.needs')}</dt>
          <dd className="font-heading font-semibold">{t(citizenView ? 'denied.neededModerator' : 'denied.neededCitizen')}</dd>
        </dl>
      </section>
      {citizenView && <p className="text-base text-muted-foreground">{t('denied.inviteHint')}</p>}
      <Button size="lg" onClick={() => navigate(held === 'citizen' ? '/citizen/reports' : homePath(me), { replace: true })}>
        <Home aria-hidden="true" />{t(held === 'citizen' ? 'denied.toReports' : 'denied.toConsole')}
      </Button>
      <Button size="lg" variant="outline" onClick={async () => { await signOut(); navigate('/sign-in', { replace: true }); }}>{t('denied.other')}</Button>
      {state.requestId && <p className="text-center font-[Noto_Sans] text-sm text-muted-foreground tabular-nums">{t('errors.reference', { id: state.requestId })}</p>}
    </GateLayout>
  );
}

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <MobileFrame>
      <p role="status" className="m-auto font-heading text-lg text-muted-foreground">{t('app.loading')}</p>
    </MobileFrame>
  );
}

export function IdentityError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <MobileFrame>
      <div className="m-auto flex max-w-80 flex-col items-center gap-4 p-6 text-center">
        <p role="alert" className="text-md">{t('errors.session')}</p>
        <Button onClick={onRetry}>{t('app.retry')}</Button>
      </div>
    </MobileFrame>
  );
}
