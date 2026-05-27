import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import FindPartnerPage from "./pages/FindPartnerPage";
import ProfilePage from "./pages/ProfilePage";
import SessionsPage from "./pages/SessionsPage";
import FeedPage from "./pages/FeedPage";
import CourtsPage from "./pages/CourtsPage";
import SchedulePage from "./pages/SchedulePage";

/* Redirect logged-in users away from the login page. */
const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/find" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/find"     element={<ProtectedRoute><FindPartnerPage /></ProtectedRoute>} />
          <Route path="/profile"  element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
          <Route path="/feed"     element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="/courts"   element={<ProtectedRoute><CourtsPage /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
