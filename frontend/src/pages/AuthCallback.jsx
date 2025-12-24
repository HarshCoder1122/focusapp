import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Extract tokens from URL fragment (Supabase OAuth returns these)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        // Legacy support for session_id
        const sessionId = params.get("session_id");

        // Debug logging
        console.log("OAuth callback - hash length:", hash.length);
        console.log("OAuth callback - access_token present:", !!accessToken);
        console.log("OAuth callback - access_token length:", accessToken?.length || 0);

        if (!accessToken && !sessionId) {
          console.error("No access token or session_id found in callback");
          navigate("/auth");
          return;
        }

        let response;

        if (accessToken) {
          // Handle Supabase OAuth callback with access_token
          response = await axios.post(`${API}/auth/google/callback`, {
            access_token: accessToken,
            refresh_token: refreshToken
          });
        } else if (sessionId) {
          // Legacy session_id handling
          response = await axios.post(`${API}/auth/google/session`, {
            session_id: sessionId
          });
        }

        if (response?.data?.user) {
          // Clear the hash from URL
          window.history.replaceState(null, "", window.location.pathname);

          // Navigate based on onboarding status
          if (response.data.user.onboarding_completed) {
            navigate("/dashboard", { state: { user: response.data.user }, replace: true });
          } else {
            navigate("/onboarding", { state: { user: response.data.user }, replace: true });
          }
        } else {
          console.error("No user data in response");
          navigate("/auth");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/auth");
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
