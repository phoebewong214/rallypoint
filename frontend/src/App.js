import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import FindPartnerPage from "./pages/FindPartnerPage";
import ProfilePage from "./pages/ProfilePage";
import SessionsPage from "./pages/SessionsPage";
import FeedPage from "./pages/FeedPage";

function Layout({ children }) {
  const { pathname } = useLocation();
  const hideNav = pathname === "/login";
  return (
    <>
      {!hideNav && <Navbar />}
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/find" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/find" element={<FindPartnerPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="*" element={<Navigate to="/find" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
