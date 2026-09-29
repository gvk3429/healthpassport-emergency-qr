
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import MyQrPage from "./pages/MyQrPage";
import EmergencyPage from "./pages/EmergencyPage";
import EmergencyProfilePage from "./pages/EmergencyProfilePage";

import AuthPage from "./pages/AuthPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

import { AuthProvider } from "./auth/AuthProvider";
import RequireVerifiedEmail from "./auth/RequireVerifiedEmail";

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}

          <Route
            path="/"
            element={<HomePage />}
          />

          <Route
            path="/login"
            element={<AuthPage />}
          />

          <Route
            path="/register"
            element={<AuthPage />}
          />

          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />

          {/* Public emergency QR page */}

          <Route
            path="/e/:qrId"
            element={<EmergencyPage />}
          />

          {/* Protected pages */}

          <Route element={<RequireVerifiedEmail />}>
            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />

            <Route
              path="/my-qr"
              element={<MyQrPage />}
            />

            <Route
              path="/profile"
              element={<EmergencyProfilePage />}
            />
          </Route>

          {/* Unknown routes */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}