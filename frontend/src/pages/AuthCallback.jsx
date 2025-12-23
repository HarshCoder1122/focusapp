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
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          navigate("/auth");
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/google/session`, {
          session_id: sessionId
        });

        if (response.data.user) {
          // Clear the hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          
          // Navigate based on onboarding status
          if (response.data.user.onboarding_completed) {
            navigate("/dashboard", { state: { user: response.data.user }, replace: true });
          } else {
            navigate("/onboarding", { state: { user: response.data.user }, replace: true });
          }
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
