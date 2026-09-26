import { CATEGORIES } from "./catalog";
import type { SimSnapshot } from "./types";

export function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function personDelta(snap: SimSnapshot, i: number) {
  return snap.v[i]!.map((x, c) => x - snap.v0[i]![c]!);
}

export function populationMeans(snap: SimSnapshot, which: "v" | "v0") {
  const src = snap[which];
  return CATEGORIES.map((_, c) => mean(src.map((row) => row[c]!)));
}

/**
 * The people who moved most over the run.
 *
 * `mag` is the length of the per-category change vector, so a person who moved +2 in
 * one category and −2 in another scores 2.8 even though their average is identical at
 * both ends. That is the intended ranking — they did change — but it means `mag` and
 * the `v0`/`v` averages can disagree, and any display showing only the averages will
 * look like it has listed someone who never moved. Show `mag` alongside them.
 *
 * People who genuinely did not move are dropped rather than padding the list to `k`:
 * in a short run, or with a strong conviction anchor, most of the population can sit
 * at zero, and ranking zeros against each other is noise.
 */
export function topChangers(snap: SimSnapshot, k = 8) {
  const rows = snap.names.map((name, i) => {
    const d = personDelta(snap, i);
    const mag = Math.sqrt(d.reduce((s, x) => s + x * x, 0));
    const dir = mean(d);
    return { i, name, isUser: snap.isUser[i], mag, dir, d, v0: mean(snap.v0[i]!), v: mean(snap.v[i]!) };
  });
  rows.sort((a, b) => b.mag - a.mag);
  return rows.filter((r) => r.mag > 0.05).slice(0, k);
}

export function extremes(snap: SimSnapshot) {
  const scores = snap.v.map((row, i) => ({ i, name: snap.names[i]!, s: mean(row) }));
  scores.sort((a, b) => a.s - b.s);
  return {
    lowest: scores.slice(0, 5),
    highest: scores.slice(-5).reverse(),
  };
}
