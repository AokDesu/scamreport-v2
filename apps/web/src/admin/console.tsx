import { Navigate, Route, Routes } from 'react-router';
import type { Me } from '@scamreport/shared';
import { primaryRole } from '@/lib/domain';
import { ConsoleLayout } from './shell';
import { QueuePage } from './queue';
import { DetailPage } from './detail';
import { MembersPage } from './members';
import { ActivityPage } from './activity';
import { DashboardPage } from './dashboard';

/** Desktop console routes. Loaded on demand so the citizen phone app never downloads charts or tables. */
export default function AdminConsole({ me }: { me: Me }) {
  return (
    <Routes>
      <Route element={<ConsoleLayout me={me} />}>
        <Route index element={<Navigate to={primaryRole(me) === 'executive' ? 'dashboard' : 'queue'} replace />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="reports/:id" element={<DetailPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
