import { StrictMode, createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import type { Me, MemberRole } from '@scamreport/shared';
import { sessionWasStored, supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import i18n from './i18n';
import './index.css';

type Identity = {pending:boolean; me:Me|null; error:boolean; retry:()=>void; signOut:()=>Promise<void>};
const IdentityContext = createContext<Identity|null>(null);
function useIdentity() {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error('IdentityProvider is required.');
  return identity;
}
function IdentityProvider({children}:{children:ReactNode}) {
  const [session,setSession] = useState<Session|null>();
  const [me,setMe] = useState<Me|null>(null);
  const [pending,setPending] = useState(true);
  const [error,setError] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const hadSession = useRef(false);
  const manualSignOut = useRef(false);
  useEffect(()=>{
    let active = true;
    void supabase.auth.getSession().then(({data,error})=>{
      if (!active) return;
      if ((error?.status && error.status < 500) || (!error && !data.session && sessionWasStored)) window.location.replace('/session-expired');
      setSession(data.session);
      if (error) setError(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event,next)=>{
      if (event === 'SIGNED_OUT' && hadSession.current && !manualSignOut.current) window.location.replace('/session-expired');
      hadSession.current = Boolean(next);
      setPending(true);setMe(null);setSession(next);
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    if (session === undefined) return;
    let active = true;
    setError(false);
    if (!session) {setMe(null);setPending(false);return;}
    setPending(true);
    void api<Me>('/me').then(value=>{if(active)setMe(value);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setPending(false);});
    return ()=>{active=false;};
  },[session,attempt]);
  async function signOut() {
    manualSignOut.current = true;
    try { await supabase.auth.signOut({scope:'local'}); }
    finally { manualSignOut.current = false; }
  }
  return <IdentityContext.Provider value={{pending,me,error,retry:()=>setAttempt(value=>value+1),signOut}}>{children}</IdentityContext.Provider>;
}
function destination(me:Me) {
  if (me.role === 'citizen') return '/citizen';
  return me.memberships.some(m=>m.role !== 'executive') ? '/admin' : '/executive';
}
function SignIn() {
  const {t} = useTranslation();
  const {pending,me} = useIdentity();
  const [busy,setBusy] = useState(false);
  const [failed,setFailed] = useState(false);
  if (!pending && me) return <Navigate to={destination(me)} replace/>;
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);setFailed(false);
    const form = new FormData(event.currentTarget);
    try {
      const {error} = await supabase.auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});
      setFailed(Boolean(error));
    } catch {setFailed(true);} finally {setBusy(false);}
  }
  return <section aria-labelledby="sign-in-title"><h1 id="sign-in-title">{t('signIn')}</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="email">{t('email')}</label><Input id="email" name="email" type="email" autoComplete="username" required disabled={busy}/>
      <label htmlFor="password">{t('password')}</label><Input id="password" name="password" type="password" autoComplete="current-password" required disabled={busy}/>
      {failed && <p role="alert">{t('loginError')}</p>}
      <Button type="submit" disabled={busy}>{t(busy ? 'busy' : 'submit')}</Button>
    </form></section>;
}
function Protected({roles,children}:{roles?:MemberRole[];children:ReactNode}) {
  const {pending,me,error,retry} = useIdentity();
  const {t} = useTranslation();
  if (pending) return <p role="status">{t('loading')}</p>;
  if (error) return <section><p role="alert">{t('sessionError')}</p><Button onClick={retry}>{t('retry')}</Button></section>;
  if (!me) return <Navigate to="/sign-in" replace/>;
  if (roles ? !me.memberships.some(m=>roles.includes(m.role)) : me.role !== 'citizen') return <Navigate to="/unauthorized" replace/>;
  return children;
}
function Home() {
  const {pending,me,error,retry} = useIdentity();
  const {t} = useTranslation();
  if (pending) return <p role="status">{t('loading')}</p>;
  if (error) return <section><p role="alert">{t('sessionError')}</p><Button onClick={retry}>{t('retry')}</Button></section>;
  return <Navigate to={me ? destination(me) : '/sign-in'} replace/>;
}
function Shell({title}:{title:string}) {
  const {me,signOut} = useIdentity();
  const {t} = useTranslation();
  const navigate = useNavigate();
  return <section><h1>{t(title)}</h1><p>{t('shell')}</p><p>{me?.email}</p>
    <Button onClick={async()=>{await signOut();navigate('/sign-in',{replace:true});}}>{t('signOut')}</Button></section>;
}
function App() {
  const {t} = useTranslation();
  useEffect(()=>{document.documentElement.lang=i18n.language;},[i18n.language]);
  return <><header><Link to="/">{t('title')}</Link><nav aria-label="Language"><Button variant="outline" onClick={()=>void i18n.changeLanguage(i18n.language==='th'?'en':'th')}>{i18n.language==='th'?'English':'ไทย'}</Button></nav></header>
    <main id="main"><Routes>
      <Route path="/" element={<Home/>}/><Route path="/sign-in" element={<SignIn/>}/>
      <Route path="/citizen" element={<Protected><Shell title="citizen"/></Protected>}/>
      <Route path="/admin" element={<Protected roles={['moderator','org_admin']}><Shell title="admin"/></Protected>}/>
      <Route path="/executive" element={<Protected roles={['executive']}><Shell title="executive"/></Protected>}/>
      <Route path="/session-expired" element={<section><h1>{t('expired')}</h1><p>{t('expiredBody')}</p><Link to="/sign-in">{t('signIn')}</Link></section>}/>
      <Route path="/unauthorized" element={<section><h1>{t('unauthorized')}</h1><p>{t('unauthorizedBody')}</p><Link to="/">{t('home')}</Link></section>}/>
      <Route path="*" element={<section><h1>{t('notFound')}</h1><Link to="/">{t('home')}</Link></section>}/>
    </Routes></main></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><IdentityProvider><App/></IdentityProvider></BrowserRouter></StrictMode>);
