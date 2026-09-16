import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/lib/store/authStore";

export function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}