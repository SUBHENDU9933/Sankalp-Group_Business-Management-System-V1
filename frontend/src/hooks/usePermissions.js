import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIONS, can, canAll, canAny, normalizeRole } from "@/utils/permissions";

export function usePermissions() {
  const { role } = useAuth();
  const normalizedRole = normalizeRole(role);

  const check = useCallback(
    (resource, action) => can(normalizedRole, resource, action),
    [normalizedRole]
  );

  const checkAny = useCallback(
    (checks) => canAny(normalizedRole, checks),
    [normalizedRole]
  );

  const checkAll = useCallback(
    (checks) => canAll(normalizedRole, checks),
    [normalizedRole]
  );

  return useMemo(
    () => ({
      role: normalizedRole,
      can: check,
      canAny: checkAny,
      canAll: checkAll,
      actions: ACTIONS,
    }),
    [normalizedRole, check, checkAny, checkAll]
  );
}
