# Pulse stops calling Podchaser

Status: Pulse no longer calls Podchaser. `trial_podchaser_relevant` is dropped (collect-trials, daily 05:40 UTC) and the Monday content harvest no longer reads Podchaser; the retired FWI input `podchaser` already skipped since the 2026-10-26 seam. The trial cost about 1,200 of the shared 25,000 monthly Podchaser points a day (about 20,500 of November's, 82%) to read 3 every day, and no published number used it. Ruling (Krish, 2026-11-18): all Podchaser attention goes to growth-mindmake and growth-makeyourmindup. This replaces the earlier ruling that brought a Podchaser input in on 2026-11-23. The Podchaser secrets in the Pulse Supabase project are now unused; removing them waits on Krish's yes, with the secret rotation.

Next: after the merge deploys, confirm the 2026-11-19 05:40 UTC collect-trials run writes no `trial_podchaser_relevant` row and its report has no Podchaser entry.

North Star check (2026-11-18): holds. No published FWI input changed; the dropped source was a trial.
