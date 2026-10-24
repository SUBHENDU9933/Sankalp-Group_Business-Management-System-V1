-- Preserve the legacy V1 agreement policy behavior; validate only the newly added V2 link.
DROP POLICY IF EXISTS agreements_insert ON public.agreements;
CREATE POLICY agreements_insert
  ON public.agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.can_create_estimate_for_lead(lead_id)
    AND (customer_id IS NULL OR private.can_access_customer(customer_id))
    AND (project_id IS NULL OR private.can_access_project(project_id))
    AND (estimate_v2_id IS NULL OR private.can_access_estimate_v2(estimate_v2_id))
  );

DROP POLICY IF EXISTS agreements_update ON public.agreements;
CREATE POLICY agreements_update
  ON public.agreements
  FOR UPDATE
  TO authenticated
  USING (private.can_access_agreement(id))
  WITH CHECK (
    private.can_access_agreement(id)
    AND (lead_id IS NULL OR private.can_access_lead(lead_id))
    AND (customer_id IS NULL OR private.can_access_customer(customer_id))
    AND (project_id IS NULL OR private.can_access_project(project_id))
    AND (estimate_v2_id IS NULL OR private.can_access_estimate_v2(estimate_v2_id))
  );

REVOKE EXECUTE ON FUNCTION private.can_access_estimate_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_estimate_v2(uuid) TO authenticated;
