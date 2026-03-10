import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { lazy, Suspense, useMemo, useCallback } from 'react';
import ProtectedRoute from './auth/ProtectedRoute';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

// Lazy-load all pages so only the active route's code is downloaded
const LoginPage = lazy(() => import('./auth/LoginPage'));
const RegisterPage = lazy(() => import('./auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./auth/OnboardingPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Pipeline = lazy(() => import('./components/Pipeline'));
const LeadList = lazy(() => import('./components/LeadList'));
const StormMap = lazy(() => import('./components/StormMap'));
const AlertSettings = lazy(() => import('./components/AlertSettings'));
const TasksView = lazy(() => import('./components/TasksView'));
const EstimatesView = lazy(() => import('./components/EstimatesView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const PublicEstimate = lazy(() => import('./components/PublicEstimate'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <div className="storm-map-loading__spinner" style={{ marginRight: 12 }} />
      Loading…
    </div>
  );
}

const viewRoutes = {
  dashboard: '/',
  pipeline: '/pipeline',
  leads: '/leads',
  'storm-map': '/storm-map',
  alerts: '/alerts',
  tasks: '/tasks',
  estimates: '/estimates',
  settings: '/settings',
  admin: '/admin',
};

const routeToView = Object.fromEntries(
  Object.entries(viewRoutes).map(([view, path]) => [path, view])
);

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeView = useMemo(() => {
    return routeToView[location.pathname] || 'dashboard';
  }, [location.pathname]);

  const handleNavigate = useCallback((view, search) => {
    const path = viewRoutes[view] || '/';
    navigate(search ? `${path}?${search}` : path);
  }, [navigate]);

  return (
    <div className="app">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} />
      <TopBar activeView={activeView} onNavigate={handleNavigate} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/leads" element={<LeadList />} />
          <Route path="/storm-map" element={<StormMap />} />
          <Route path="/alerts" element={<AlertSettings />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/estimates" element={<EstimatesView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/estimate/:token" element={<PublicEstimateRoute />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

function PublicEstimateRoute() {
  const { token } = useParams();
  return <PublicEstimate token={token} />;
}
