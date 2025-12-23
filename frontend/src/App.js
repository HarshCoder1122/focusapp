import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";

// Pages
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import FocusTimerPage from "@/pages/FocusTimerPage";
import PlannerPage from "@/pages/PlannerPage";
import WalletPage from "@/pages/WalletPage";
import ProfilePage from "@/pages/ProfilePage";
import AuthCallback from "@/pages/AuthCallback";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.withCredentials = true;

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // If user data is passed from AuthCallback, use it directly
  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`);
        if (response.data) {
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        setIsAuthenticated(false);
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate, location.state]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check if onboarding is needed
  if (user && !user.onboarding_completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return React.cloneElement(children, { user, setUser });
};

// App Router with session_id detection
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id (Google OAuth callback)
  // This must be synchronous during render to prevent race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/focus"
        element={
          <ProtectedRoute>
            <FocusTimerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/planner"
        element={
          <ProtectedRoute>
            <PlannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster position="top-center" richColors />
        <div className="noise-overlay" />
      </div>
    </ThemeProvider>
  );
}

export default App;
