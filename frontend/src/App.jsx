import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import ForgotPasswordPage  from './pages/ForgotPasswordPage';
import ResetPasswordPage   from './pages/ResetPasswordPage';
import DashboardPage      from './pages/DashboardPage';
import ProfilePage        from './pages/ProfilePage';
import CategoriesPage     from './pages/CategoriesPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import UsersPage          from './pages/UsersPage';
import PermissionsPage    from './pages/PermissionsPage';
import ReportsPage        from './pages/ReportsPage';
import NotFoundPage       from './pages/NotFoundPage';

import ProjectsListPage  from './pages/projects/ProjectsListPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import ProjectFormPage   from './pages/projects/ProjectFormPage';
import MyTasksPage       from './pages/MyTasksPage';
import CalendarPage      from './pages/CalendarPage';
import AuditPage         from './pages/AuditPage';
import TemplatesPage     from './pages/TemplatesPage';
import PortfolioPage     from './pages/PortfolioPage';
import OKRsPage          from './pages/OKRsPage';
import RolesPage         from './pages/RolesPage';
import GuestPage         from './pages/GuestPage';
import AttendancePage    from './pages/AttendancePage';
import AccessRequestsPage from './pages/AccessRequestsPage';
import PWAInstallPrompt  from './components/PWAInstallPrompt';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme);
  useEffect(() => { initTheme(); }, []);

  return (
    <Router>
      <Toaster position="top-right" richColors closeButton />
      <PWAInstallPrompt />
      <Routes>
        {/* Public */}
        <Route path="/"                 element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register"         element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password"  element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password"   element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route path="/dashboard"        element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/profile"          element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/categories"       element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
        <Route path="/reports"          element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/company-settings" element={<PrivateRoute><CompanySettingsPage /></PrivateRoute>} />
        <Route path="/users"            element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="/permissions"      element={<PrivateRoute><PermissionsPage /></PrivateRoute>} />

        <Route path="/my-tasks"          element={<PrivateRoute><MyTasksPage /></PrivateRoute>} />
        <Route path="/calendar"          element={<PrivateRoute><CalendarPage /></PrivateRoute>} />
        <Route path="/projects"          element={<PrivateRoute><ProjectsListPage /></PrivateRoute>} />
        <Route path="/projects/new"      element={<PrivateRoute><ProjectFormPage /></PrivateRoute>} />
        <Route path="/projects/:id"      element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />
        <Route path="/projects/:id/edit" element={<PrivateRoute><ProjectFormPage /></PrivateRoute>} />

        <Route path="/templates"  element={<PrivateRoute><TemplatesPage /></PrivateRoute>} />
        <Route path="/audit"      element={<PrivateRoute><AuditPage /></PrivateRoute>} />
        <Route path="/portfolio"  element={<PrivateRoute><PortfolioPage /></PrivateRoute>} />
        <Route path="/okrs"       element={<PrivateRoute><OKRsPage /></PrivateRoute>} />
        <Route path="/roles"      element={<PrivateRoute><RolesPage /></PrivateRoute>} />
        <Route path="/attendance"       element={<PrivateRoute><AttendancePage /></PrivateRoute>} />
        <Route path="/access-requests" element={<PrivateRoute><AccessRequestsPage /></PrivateRoute>} />
        <Route path="/guest/:token" element={<GuestPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}
