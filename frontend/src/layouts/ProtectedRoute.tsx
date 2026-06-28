import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();
  const redirect = `${location.pathname}${location.search}`;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={authService.dashboardPath(user.role)} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const redirect = `${location.pathname}${location.search}`;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={authService.dashboardPath(user.role)} replace />;
  }
  return <>{children}</>;
}
