import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  // Check localStorage as fallback — covers the race condition where
  // navigate('/') fires before setUser state update commits
  if (!user && !localStorage.getItem('token')) return <Navigate to="/login" replace />;

  return children;
}
