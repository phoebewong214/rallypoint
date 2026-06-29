import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { WakeBanner } from "./components/WakeBanner";
import { SupportWidget } from "./components/SupportWidget";

import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import VerifyPendingPage from "./pages/VerifyPendingPage";
import FindPartnerPage from "./pages/FindPartnerPage";
import ProfilePage from "./pages/ProfilePage";
import SessionsPage from "./pages/SessionsPage";

// Code-split the Courts pages: they pull in Leaflet (~150KB gz), which no other
// page needs — keeping it out of the main bundle.
const CourtsPage = React.lazy(() => import("./pages/CourtsPage"));
const CourtDetailPage = React.lazy(() => import("./pages/CourtDetailPage"));
// Admin-only — keep its bundle out of every other user's download.
const AdminPage = React.lazy(() => import("./pages/AdminPage"));

/* Redirect logged-in users away from the login page. */
const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/find" replace />;
  return <>{children}</>;
};

/* Gate /admin behind the is_admin flag. Non-admins (and logged-out users) are
   bounced; the backend independently enforces this, so this is just UX. */
const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!user?.isAdmin) return <Navigate to="/find" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WakeBanner />
        <SupportWidget />
        <Routes>
          <Route path="/" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/verify-pending"
            element={
              <ProtectedRoute requireVerified={false}>
                <VerifyPendingPage />
              </ProtectedRoute>
            }
          />
          <Route path="/find"     element={<ProtectedRoute><FindPartnerPage /></ProtectedRoute>} />
          <Route path="/profile"  element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
          <Route
            path="/courts"
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="page" style={{ minHeight: "60vh" }} />}>
                  <CourtsPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/courts/:slug"
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="page" style={{ minHeight: "60vh" }} />}>
                  <CourtDetailPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <Suspense fallback={<div className="page" style={{ minHeight: "60vh" }} />}>
                  <AdminPage />
                </Suspense>
              </AdminOnly>
            }
          />
          {/* /schedule folded into the Profile page's Schedule tab; keep old links working. */}
          <Route path="/schedule" element={<Navigate to="/profile?tab=schedule" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
