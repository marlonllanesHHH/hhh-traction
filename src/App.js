import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Meetings from './components/meetings/Meetings';
import MeetingDetail from './components/meetings/MeetingDetail';
import Scorecard from './components/scorecard/Scorecard';
import AccountabilityChart from './components/accountability/Accountability';
import Vision from './components/vision/Vision';
import Evaluations from './components/evaluations/Evaluations';
import AdminTeam from './components/admin/AdminTeam';
import './styles/globals.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0A0A0A',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#1A9BA1',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/meetings" element={
        <ProtectedRoute>
          <Layout><Meetings /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/meetings/:id" element={
        <ProtectedRoute>
          <Layout><MeetingDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/accountability" element={
        <ProtectedRoute>
          <Layout><AccountabilityChart /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/vision" element={
        <ProtectedRoute>
          <Layout><Vision /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/evaluations" element={
        <ProtectedRoute>
          <Layout><Evaluations /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/team" element={
        <ProtectedRoute>
          <Layout><AdminTeam /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
