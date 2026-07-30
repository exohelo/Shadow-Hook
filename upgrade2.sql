-- ============================================================================
-- SHADOW HOOK — UPGRADE 2 (upgrade2.sql)
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- 1) sheet_log — the community sheet's rows, pulled by the worker, so the
--    prediction engine stays current WITHOUT re-shipping index.html.
-- 2) count_wire.acc — count reports now carry the reporter's accuracy score,
--    so the server can weight proven reporters later.
-- ============================================================================

-- 1 ── the live sheet feed --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sheet_log (
  id         text PRIMARY KEY,          -- "<date>_<AM|PM>", e.g. "2026-08-01_PM"
  date       text NOT NULL,             -- YYYY-MM-DD
  ampm       text NOT NULL,             -- AM | PM
  ch         int,                       -- casual hall jobs (final)
  tot        int,                       -- total jobs (union scale)
  act        int,                       -- letters the board actually moved
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sheet_log_date_idx ON public.sheet_log (date);

ALTER TABLE public.sheet_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sl_read ON public.sheet_log;
-- everyone reads; ONLY the worker writes (service key bypasses RLS — no client write policy on purpose)
CREATE POLICY sl_read ON public.sheet_log FOR SELECT TO anon, authenticated USING (true);

-- 2 ── reporter accuracy on count reports ----------------------------------
ALTER TABLE public.count_wire ADD COLUMN IF NOT EXISTS acc int;

-- verify --------------------------------------------------------------------
SELECT t.tablename, t.rowsecurity AS rls_on, COUNT(p.policyname) AS policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname=t.schemaname AND p.tablename=t.tablename
WHERE t.schemaname='public' AND t.tablename IN ('sheet_log','count_wire')
GROUP BY t.tablename, t.rowsecurity ORDER BY t.tablename;
