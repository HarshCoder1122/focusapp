import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { initializeStudyReminders, stopStudyReminders } from "@/utils/studyReminder";

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const API = `${BACKEND_URL}/api`;

// Token storage key for mobile persistence
export const AUTH_TOKEN_KEY = "revealiq_auth_token";

// Configure axios defaults
axios.defaults.withCredentials = true;

// Axios interceptor to add Authorization header from localStorage
// This ensures mobile devices stay logged in even when cookies don't persist
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Axios response interceptor to handle 401 errors (clear invalid tokens)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

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

  // Initialize study reminders when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated) {
      // Check if notifications are enabled for this user
      const hasNotifications = 'Notification' in window &&
        Notification.permission === 'granted' &&
        !!user.push_subscription;

      initializeStudyReminders(hasNotifications);
    }

    // Cleanup on unmount
    return () => {
      stopStudyReminders();
    };
  }, [user, isAuthenticated]);

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

// App Router with OAuth callback detection
function AppRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasChecked = useRef(false);

  // Check auth status on app launch for smart redirect
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkAuthOnLaunch = async () => {
      // CRITICAL: Skip auth check if we have OAuth tokens in the URL hash
      // This prevents a race condition where we redirect to /auth before 
      // the AuthCallback component can process the tokens
      if (location.hash?.includes("access_token=") || location.hash?.includes("session_id=")) {
        setCheckingAuth(false);
        return; // Let AuthCallback handle this
      }

      // Only check if on landing page
      if (location.pathname !== "/") {
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/me`);
        if (response.data) {
          setIsAuthenticated(true);
          // Redirect to dashboard or onboarding based on user status
          if (response.data.onboarding_completed) {
            navigate("/dashboard", { state: { user: response.data }, replace: true });
          } else {
            navigate("/onboarding", { state: { user: response.data }, replace: true });
          }
        }
      } catch (error) {
        // Not authenticated, stay on landing page
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuthOnLaunch();
  }, [location.pathname, navigate, location.hash]);

  // Check URL fragment for OAuth tokens (Supabase returns access_token)
  // This must be synchronous during render to prevent race conditions
  if (location.hash?.includes("access_token=") || location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  // Show loading while checking auth on landing page
  if (checkingAuth && location.pathname === "/") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="spinner" />
      </div>
    );
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
