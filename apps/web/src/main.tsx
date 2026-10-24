import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Me } from '@scamreport/shared';
import { ApiFailure } from '@/lib/api';
import { homePath, primaryRole } from '@/lib/domain';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { IdentityProvider, useIdentity } from '@/auth/identity';
import { IdentityError, LoadingScreen, SessionExpired, SignIn, Unauthorized } from '@/auth/gates';
import { MobileFrame } from '@/citizen/shell';
import { ReportFlow } from '@/citizen/report-flow';
import { Feed, MyReports, Submitted } from '@/citizen/screens';
import './i18n';
import './index.css';

// Route-level code split (the one dynamic import): the citizen phone app never loads the console's charts and tables.
const AdminConsole = lazy(() => import('@/admin/console'));

const queryClient = new QueryClient({
  defaultOptions: {
    // 4xx answers are decisions (denied, not found, invalid), not transient faults: never retry them.
    queries: { retry: (failures, error) => !(error instanceof ApiFailure && error.status >= 400 && error.status < 500) && failures < 2, refetchOnWindowFocus: false },
  },
});

/** UX guard only; the API and row-level security decide access. `area` is the shell the route belongs to. */
function Guard({ area, children }: { area: 'citizen' | 'staff'; children: (me: Me) => ReactNode }) {
  const { session, me, pending, error, retry } = useIdentity();
  if (session === null) return <Navigate to="/sign-in" replace />;
  if (pending) return <LoadingScreen />;
  if (error || !me) return <IdentityError onRetry={retry} />;
  const citizen = primaryRole(me) === 'citizen';
  if (area === 'staff' && citizen) return <Navigate to="/unauthorized" replace state={{ need: 'moderator' }} />;
  if (area === 'citizen' && !citizen) return <Navigate to="/unauthorized" replace state={{ need: 'citizen' }} />;
  return children(me);
}

function Home() {
  const { session, me, pending, error, retry } = useIdentity();
  if (session === null) return <Navigate to="/sign-in" replace />;
  if (pending) return <LoadingScreen />;
  if (error || !me) return <IdentityError onRetry={retry} />;
  return <Navigate to={homePath(me)} replace />;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <MobileFrame>
      <main id="main" className="m-auto flex max-w-80 flex-col items-center gap-4 p-6 text-center">
        <h1 className="text-2xl">{t('notFound.title')}</h1>
        <p className="text-md text-muted-foreground">{t('notFound.body')}</p>
        <Button asChild size="lg"><Link to="/">{t('notFound.home')}</Link></Button>
      </main>
    </MobileFrame>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/session-expired" element={<SessionExpired />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/citizen" element={<Guard area="citizen">{() => <MobileFrame><Outlet /></MobileFrame>}</Guard>}>
        <Route index element={<Navigate to="feed" replace />} />
        <Route path="feed" element={<Feed />} />
        <Route path="report" element={<Guard area="citizen">{me => <ReportFlow me={me} />}</Guard>} />
        <Route path="report/received/:id" element={<Submitted />} />
        <Route path="reports" element={<MyReports />} />
      </Route>
      <Route path="/admin/*" element={<Guard area="staff">{me => <Suspense fallback={<LoadingScreen />}><AdminConsole me={me} /></Suspense>}</Guard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <IdentityProvider>
          <App />
          {/* On phones the primary action sits at the bottom, so toasts appear at the top. */}
          <Toaster position={window.matchMedia('(min-width: 1024px)').matches ? 'bottom-right' : 'top-center'} />
        </IdentityProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
