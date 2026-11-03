import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./hooks/useAuth";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UsersPage from "./pages/UsersPage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import SettingsPage from "./pages/SettingsPage";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";

function Protected({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!data?.user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { data, isLoading } = useAuth();
  const user = data?.user ?? null;

  if (isLoading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
        </Route>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
          <Route path="/users" element={<Protected><UsersPage /></Protected>} />
          <Route path="/transactions" element={<Protected><TransactionsPage /></Protected>} />
          <Route path="/transactions/:id" element={<Protected><TransactionDetailPage /></Protected>} />
          <Route path="/activities" element={<Protected><ActivityLogsPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
