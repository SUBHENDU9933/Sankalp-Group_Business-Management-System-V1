-- Link agreements to V2 estimates without breaking existing V1 agreement links.
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS estimate_v2_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agreements'::regclass
      AND conname = 'agreements_estimate_v2_id_fkey'
  ) THEN
    ALTER TABLE public.agreements
      ADD CONSTRAINT agreements_estimate_v2_id_fkey
      FOREIGN KEY (estimate_v2_id)
      REFERENCES public.estimates_v2(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agreements'::regclass
      AND conname = 'agreements_single_estimate_source_check'
  ) THEN
    ALTER TABLE public.agreements
      ADD CONSTRAINT agreements_single_estimate_source_check
      CHECK (estimate_id IS NULL OR estimate_v2_id IS NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS agreements_estimate_v2_id_idx
  ON public.agreements (estimate_v2_id)
  WHERE estimate_v2_id IS NOT NULL;

-- Mirror the existing V1 estimate access rule for V2 estimates.
CREATE OR REPLACE FUNCTION private.can_access_estimate_v2(p_estimate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.estimates_v2 e
      WHERE e.id = p_estimate_id
        AND (
          (e.lead_id IS NOT NULL AND private.can_access_lead(e.lead_id))
          OR (e.lead_id IS NULL AND e.created_by = auth.uid())
        )
    );
$function$;

GRANT EXECUTE ON FUNCTION private.can_access_estimate_v2(uuid) TO authenticated;

-- Keep the existing agreement scope checks and validate any linked estimate too.
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
    AND (estimate_id IS NULL OR private.can_access_estimate(estimate_id))
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
    AND (estimate_id IS NULL OR private.can_access_estimate(estimate_id))
    AND (estimate_v2_id IS NULL OR private.can_access_estimate_v2(estimate_v2_id))
  );
