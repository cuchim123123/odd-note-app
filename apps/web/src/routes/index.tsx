import { createBrowserRouter } from 'react-router-dom';
import { AuthLayout } from '../features/auth/components/auth-layout';
import { LoginPage } from '../features/auth/components/login-page';
import { RegisterPage } from '../features/auth/components/register-page';
import { ProtectedRoute } from '../features/auth/components/protected-route';
import { ForgotPasswordPage } from '../features/auth/components/forgot-password-page';
import { ResetPasswordPage } from '../features/auth/components/reset-password-page';
import { DashboardLayout } from '../components/layout/dashboard-layout';
import { SettingsPage } from '../features/settings/components/settings-page';
import { NoteDashboard } from '../features/notes/components/note-dashboard';

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
        element: <NoteDashboard />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
    ],
  },
  {
    path: '*',
    element: <div>Not Found</div>, // Placeholder
  },
]);
