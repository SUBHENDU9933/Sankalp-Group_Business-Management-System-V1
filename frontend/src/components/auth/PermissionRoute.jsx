import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export default function PermissionRoute({ resource, action = "view", children }) {
  const { session, profile, loading } = useAuth();
  const { can } = usePermissions();

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="label-uppercase animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!session || !can(resource, action)) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}
