# culture_project
Agent-based simulation of community culture, driven by adaptive polling and social-interaction dynamics.

# Line — Community Culture Lab

A model of how a community's culture forms and shifts over time. A dynamic front-end poll locates each person on a −12…+12 moral spectrum per category (alcohol/drugs, personality, Biblical practices, sex, extracurriculars), and a back-end simulation lets those people meet, cluster, and pull on one another's positions over a simulated season.

## Pages

`src/routes/`

- `index.tsx` — Overview
- `poll.tsx` — the adaptive question tree
- `weights.tsx` — edit question wording and scoring equations
- `lab.tsx` — run and tune simulations; also where the model's assumptions are documented inline

## Model core

`src/lib/culture/`

- `spectra.ts` — the statement text for every category × mode
- `catalog.ts` — category definitions, series colors, and the 127-node decision trees; resolves edited question text via `questionText()`
- `poll.ts` — tree walking, leaf scoring, and communal-response → α (swayability) conversion
- `severity.ts` — the weight equation for each answer (`w_PMC·(PMC/10) + w_PX·PX + w_SC·SC`, after Jones's moral-intensity factors as trimmed by McMahon & Harvey 2006) and the placeholder weight used when an equation is left incomplete
- `simulate.ts` — population synthesis and the interaction loop (Poisson-random meetings, Hegselmann–Krause-style local averaging, Friedkin–Johnsen anchoring back to each person's starting score)
- `params.ts` — the Lab's control ranges and the description of what each parameter does
- `stats.ts` — population means, top changers, extremes
- `store.ts` — the zustand store, persisted to `localStorage` under `line-culture-lab-v4`
- `types.ts`, `rng.ts` — shared types and seeded randomness

## Supporting UI

`src/components/`

- `shell.tsx` — page chrome
- `results.tsx`, `visual-tree.tsx` — outcome views
- `network-graph.tsx` — the interaction graph
- `ui.tsx`, `info-tip.tsx` — shared primitives

No server, database, or auth — everything runs client-side and persists to `localStorage`; clearing site data resets the poll, equations, and last run.
