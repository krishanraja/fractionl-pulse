-- The live pipeline only collects prestige-media observations from The Guardian.
-- Normalize derived mover copy without changing scores, ranks, or methodology.
update public.movers
set note = replace(
  note,
  ' prestige articles (Guardian/NYT) - ',
  ' prestige articles from The Guardian - '
)
where note like '% prestige articles (Guardian/NYT) - %';
