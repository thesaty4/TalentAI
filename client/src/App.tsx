import { Navigate, Route, Routes } from 'react-router-dom';
import { PrivateRoute } from './auth/PrivateRoute';
import { useAuth } from './auth/useAuth';
import { Shell } from './layout/Shell';
import { LoginPage } from './pages/auth/LoginPage';
import { ManagerDashboard } from './pages/dashboard/ManagerDashboard';
import { HRDashboard } from './pages/dashboard/HRDashboard';
import { AISearchPage } from './pages/search/AISearchPage';
import { PipelinePage } from './pages/pipeline/PipelinePage';
import { ResourcePoolPage } from './pages/pool/ResourcePoolPage';
import { IRCAppliedPage } from './pages/irc-applied/IRCAppliedPage';
import { AllProjectsPage } from './pages/projects/AllProjectsPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { CandidateProfilePage } from './pages/employees/CandidateProfilePage';
import { OpenIRCsPage } from './pages/candidate/OpenIRCsPage';
import { MyPipelinePage } from './pages/candidate/MyPipelinePage';
import { MyFeedbackPage } from './pages/candidate/MyFeedbackPage';
import { UpcomingPage } from './pages/candidate/UpcomingPage';

function RoleDashboard() {
  const { user } = useAuth();
  return user?.role === "hr" ? <HRDashboard /> : <ManagerDashboard />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route element={<Shell />}>
          <Route path="/dashboard"      element={<RoleDashboard />} />
          <Route path="/search"         element={<AISearchPage />} />
          <Route path="/pipeline"       element={<PipelinePage />} />
          <Route path="/pool"           element={<ResourcePoolPage />} />
          <Route path="/irc-applied"    element={<IRCAppliedPage />} />
          <Route path="/projects"       element={<AllProjectsPage />} />
          <Route path="/projects/:id"   element={<ProjectDetailPage />} />
          <Route path="/employees/:id"  element={<CandidateProfilePage />} />
          <Route path="/open-ircs"      element={<OpenIRCsPage />} />
          <Route path="/my-pipeline"    element={<MyPipelinePage />} />
          <Route path="/feedback"       element={<MyFeedbackPage />} />
          <Route path="/upcoming"       element={<UpcomingPage />} />
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
