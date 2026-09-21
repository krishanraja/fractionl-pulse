-- 019_retire_supply_trends.sql
--
-- ORDERING: apply only AFTER deploying ingest-signals and calculate-fwi with
-- serpapi_supply_trends removed from the weight tables. Applied first, the
-- collector simply rewrites the health row on the next run.
--
-- Retires the source's monitoring row. Krish's decision, 2026-09-21; the
-- reasoning and the measured impact are in docs/DATA_SOURCES_ROADMAP.md §2.
--
-- It was not a broken collector. It measured four supply-intent search terms
-- sitting at Google Trends' reporting floor: no reading on most days, and a
-- constant 5-6 when present. Over the 113 days from 2026-06-01 it contributed on
-- 56, and on those days it pulled the supply pillar from 65.13 to 59.71 — -1.08
-- on the headline, on roughly half of all days. Its 0.03 completeness weight
-- moved pro rata to the three remaining supply sources, so the supply pillar
-- keeps its 0.17 share of the denominator.
--
-- Historical `signals` rows are deliberately NOT deleted. They are the evidence
-- for every score published before today, and scores are not restated. Only the
-- forward-looking monitoring row goes, so "sources down" counts against the 20
-- sources the index actually intends to collect.

delete from public.data_source_health
 where source = 'serpapi_supply_trends' and pipeline = 'fwi';
