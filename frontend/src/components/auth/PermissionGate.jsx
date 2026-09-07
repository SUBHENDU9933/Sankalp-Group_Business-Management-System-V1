import { usePermissions } from "@/hooks/usePermissions";

export default function PermissionGate({ resource, action = "view", children, fallback = null }) {
  const { can } = usePermissions();
  return can(resource, action) ? children : fallback;
}
