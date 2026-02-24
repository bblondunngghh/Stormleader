import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Pipeline from './components/Pipeline';
import StormMap from './components/StormMap';

function AppShell() {
  const [activeView, setActiveView] = useState('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'pipeline':
        return <Pipeline />;
      case 'leads':
        return <Pipeline />;
      case 'storm-map':
        return <StormMap />;
      default:
        return (
          <div className="main-content">
            <div className="dashboard-panel glass" style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
                {activeView.charAt(0).toUpperCase() + activeView.slice(1).replace('-', ' ')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                This screen is coming soon.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <TopBar activeView={activeView} />
      {renderView()}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
