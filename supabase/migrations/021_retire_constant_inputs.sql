-- 021_retire_constant_inputs.sql
--
-- SUPERSEDED 2026-10-23, before it was applied: ingest-signals deletes these
-- rows itself on every run from the 2026-10-26 seam, so nothing depends on this
-- file being applied at the right moment. Kept as the record; applying it is
-- harmless (the delete is idempotent) but unnecessary.
--
-- ORDERING (historical): apply only AFTER the first FWI method v2 run (2026-10-26 06:00 UTC)
-- has written its fwi_scores row. ingest-signals v66 stops collecting these nine
-- sources from that date and no longer writes their health rows, so after the
-- seam these rows would sit as stale "failed" or "healthy" entries forever.
--
-- Ruling (Krish, 2026-10-23), docs/CITABILITY.md "Rulings": retire nine inputs
-- whose normalized value never moved. Measured 2026-10-23 from `signals`, daily
-- era 2026-06-01 onward:
--   brave_news, brave_web, reddit, brave_talent  stored the collector's page
--                                                size of 20, not a count
--   guardian                                      0 on every day it existed
--   mediastack                                    0 on every day since 2026-06-01
--   podchaser, gofractional                       normalized at the 100 ceiling
--   serpapi_trends                                normalized at the floor of 5
--                                                 since 2026-08-14
--
-- Historical `signals` rows are deliberately NOT deleted: they are the evidence
-- for every score published before the seam, and published scores are never
-- restated. Only the forward-looking monitoring rows go.

delete from public.data_source_health
 where pipeline = 'fwi'
   and source in ('brave_news', 'brave_web', 'reddit', 'brave_talent',
                  'guardian', 'mediastack', 'podchaser', 'gofractional',
                  'serpapi_trends');
