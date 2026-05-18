import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AuthLayout } from '../features/auth/components/auth-layout';
import { LoginPage } from '../features/auth/components/login-page';
import { RegisterPage } from '../features/auth/components/register-page';
import { ProtectedRoute } from '../features/auth/components/protected-route';
import { GuestRoute } from '../features/auth/components/guest-route';
import { ForgotPasswordPage } from '../features/auth/components/forgot-password-page';
import { ResetPasswordPage } from '../features/auth/components/reset-password-page';
import { VerifyEmailPage } from '../features/auth/components/verify-email-page';
import { DashboardLayout } from '../components/layout/dashboard-layout';
import { SettingsPage } from '../features/settings/components/settings-page';
import { NoteDashboard } from '../features/notes/components/note-dashboard';
import { NotificationsPage } from '../features/notifications/components/notifications-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/notes" replace />,
      },
      {
        path: 'notes',
        element: <NoteDashboard />,
      },
      {
        path: 'notes/:noteId',
        element: <NoteDashboard />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: (
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        ),
      },
      {
        path: '/register',
        element: (
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <GuestRoute>
            <ResetPasswordPage />
          </GuestRoute>
        ),
      },
      {
        path: '/verify-email/:token',
        element: <VerifyEmailPage />,
      },
    ],
  },
  {
    path: '*',
    element: <div>Not Found</div>, // Placeholder
  },
]);
