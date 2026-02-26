import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Pipeline from './components/Pipeline';
import LeadList from './components/LeadList';
import StormMap from './components/StormMap';
import AlertSettings from './components/AlertSettings';
import TasksView from './components/TasksView';
import EstimatesView from './components/EstimatesView';
import SettingsView from './components/SettingsView';
import PublicEstimate from './components/PublicEstimate';

const viewRoutes = {
  dashboard: '/',
  pipeline: '/pipeline',
  leads: '/leads',
  'storm-map': '/storm-map',
  alerts: '/alerts',
  tasks: '/tasks',
  estimates: '/estimates',
  settings: '/settings',
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

  const handleNavigate = useCallback((view) => {
    const path = viewRoutes[view] || '/';
    navigate(path);
  }, [navigate]);

  return (
    <div className="app">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} />
      <TopBar activeView={activeView} onNavigate={handleNavigate} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/leads" element={<LeadList />} />
        <Route path="/storm-map" element={<StormMap />} />
        <Route path="/alerts" element={<AlertSettings />} />
        <Route path="/tasks" element={<TasksView />} />
        <Route path="/estimates" element={<EstimatesView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
  );
}

function PublicEstimateRoute() {
  const { token } = useParams();
  return <PublicEstimate token={token} />;
}

