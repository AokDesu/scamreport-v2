import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import type { Me } from '@scamreport/shared';
import { sessionWasStored, supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { expireSession, lastAccount, sessionEnd } from '@/lib/session';
import { drafts } from '@/lib/draft';

type Identity = {
  /** undefined while Auth initializes; null when signed out. */
  session: Session | null | undefined;
  me: Me | undefined;
  pending: boolean;
  error: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
};
const IdentityContext = createContext<Identity | null>(null);

export function useIdentity() {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error('IdentityProvider is required.');
  return identity;
}

/**
 * Supabase Auth is the session source; GET /me is the verified identity and current memberships.
 * Route guards built on this are UX only: the API and row-level security enforce access.
 */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>();
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let hadSession = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      // A stored session that Auth could not restore means it expired while the app was closed.
      if ((error?.status && error.status < 500) || (!error && !data.session && sessionWasStored)) void expireSession('expired');
      hadSession = Boolean(data.session);
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' && hadSession && !sessionEnd.expected) void expireSession('expired');
      hadSession = Boolean(next);
      setSession(next);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') queryClient.removeQueries();
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);

  const userId = session?.user.id;
  const identity = useQuery({
    queryKey: ['me', userId],
    queryFn: () => api<Me>('/me'),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  useEffect(() => { if (identity.data) lastAccount.set(identity.data.id, identity.data.email); }, [identity.data]);

  async function signOut() {
    sessionEnd.expected = true;
    try {
      if (userId) await drafts.remove(userId);
      lastAccount.clear();
      await supabase.auth.signOut({ scope: 'local' });
    } finally { sessionEnd.expected = false; }
  }

  const value: Identity = {
    session,
    me: session ? identity.data : undefined,
    pending: session === undefined || (Boolean(session) && identity.isPending),
    error: Boolean(session) && identity.isError,
    retry: () => void identity.refetch(),
    signOut,
  };
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
