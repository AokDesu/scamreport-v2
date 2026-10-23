import type { ApiError } from '@scamreport/shared';
import { supabase } from './supabase';
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {data:{session},error} = await supabase.auth.getSession();
  if (error) {
    if (error.status && error.status < 500) window.location.replace('/session-expired');
    throw new Error('Session check failed. Retry the connection.');
  }
  const headers = new Headers(init.headers);
  headers.set('X-Request-Id',crypto.randomUUID());
  if (session) headers.set('Authorization','Bearer ' + session.access_token);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type','application/json');
  const response = await fetch('/api' + path,{...init,headers});
  if (!response.ok) {
    const failure: ApiError = await response.json();
    if (response.status === 401) {
      await supabase.auth.signOut({scope:'local'});
      window.location.replace(failure.error.code === 'SESSION_EXPIRED' ? '/session-expired' : '/sign-in');
    } else if (response.status === 403) window.location.assign('/unauthorized');
    throw new Error(failure.error.message + ' [' + failure.error.requestId + ']');
  }
  const body: {data:T} = await response.json();
  return body.data;
}
