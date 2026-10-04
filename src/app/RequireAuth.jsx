import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/lib/store/authStore";

export function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user);
  const validateSession = useAuthStore((s) => s.validateSession);
  const location = useLocation();

  /* On every page change: sign out deleted / disabled users and pick up
     role changes made in Settings → Users */
  useEffect(() => {
    validateSession();
  }, [location.pathname, validateSession]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}