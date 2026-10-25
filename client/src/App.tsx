/**
 * App.tsx – Root component with routing, theme init, and auth bootstrap
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Layout
import Navbar from './components/Navbar';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import TheoryPage from './pages/TheoryPage';
import SimulatorPage from './pages/SimulatorPage';
import ObservationsPage from './pages/ObservationsPage';
import GraphsPage from './pages/GraphsPage';
import QuizPage from './pages/QuizPage';
import ReportPage from './pages/ReportPage';
import TeacherPage from './pages/TeacherPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  const { fetchMe, setTheme, theme, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Bootstrap: apply saved theme and fetch current user
  useEffect(() => {
    setTheme(theme);
    fetchMe().finally(() => setLoading(false));

    // Listen for auth:logout events dispatched by the API interceptor
    const handleLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageLoader />;

  return (
    <div className="page-wrapper">
      <Navbar />
      <main>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Lab pages – accessible to all, but full features need login */}
          <Route path="/theory" element={<TheoryPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/observations" element={<ObservationsPage />} />
          <Route path="/graphs" element={<GraphsPage />} />
          <Route path="/quiz" element={<QuizPage />} />

          {/* Requires auth */}
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />

          {/* Teacher / Admin only */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                <TeacherPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
