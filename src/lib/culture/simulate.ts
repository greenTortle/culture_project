import { CATEGORIES, CATEGORY_IDS } from "./catalog";
import { agentName, mulberry32, poisson, randn } from "./rng";
import {
  anchorStrength,
  influence,
  median,
  plasticityAt,
  socialCoefficients,
  stubbornnessFromAlpha,
  swayMultiplier,
  walkTreeRandom,
} from "./poll";
import { answerScore, computeConsensus } from "./severity";
import type {
  ConsensusTable,
  EdgeRec,
  HistoryPoint,
  LeafEquations,
  PersonProfile,
  PollLeaf,
  SimParams,
  SimSnapshot,
} from "./types";

/** Scores live on this scale; ±12 is the practical span of the leaf weights. */
export const SCORE_MIN = -12;
export const SCORE_MAX = 12;

/** No weight table: walks fall back to each leaf's generated placeholder weights. */
const NO_TABLE = {};

/** Largest accepted group-size decay; at 1 the size distribution would not decay. */
export const GROUP_DECAY_MAX = 0.95;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pietyForMix(mix: SimParams["mix"], i: number, n: number, rand: () => number) {
  if (mix === "homogeneous") return clamp(0.55 + randn(rand) * 0.18, -1, 1);
  if (mix === "polarized")
    return i < n / 2
      ? clamp(0.7 + randn(rand) * 0.15, -1, 1)
      : clamp(-0.55 + randn(rand) * 0.2, -1, 1);
  if (mix === "mixed") return clamp(randn(rand) * 0.45, -1, 1);
  return clamp(randn(rand) * 0.7, -1, 1);
}

/** Expected meeting size under the geometric size rule, ignoring the population cap. */
export function expectedGroupSize(groupDecay: number) {
  const q = clamp(groupDecay, 0, GROUP_DECAY_MAX);
  return 2 + q / (1 - q);
}

export interface Population {
  people: PersonProfile[];
  /** Social consensus per tree, measured once from everyone's starting answers. */
  consensus: ConsensusTable;
}

/**
 * Build the community for one run.
 *
 * Four passes, because each depends on the whole population rather than one person:
 *
 *   1. Everyone's poll answers and private traits are drawn (the poll-taker, if any,
 *      brings their own answers). The random draws happen in the same order as
 *      before weight equations existed, so a seed still produces the same people.
 *   2. Social consensus (SC) is measured per tree from where those answers landed.
 *   3. Every answer is scored from its weight equation — its authored coefficients,
 *      PMC and PX, plus the SC just measured — or its placeholder weight if the
 *      equation is not complete.
 *   4. α is derived from each person's scored answers, and stubbornness is nudged by
 *      how swayable that person is relative to the population median.
 */
export function synthesizePopulation(
  params: SimParams,
  equations: Record<string, LeafEquations>,
  user?: PersonProfile | null,
): Population {
  const rand = mulberry32(params.seed);
  const n = Math.max(2, params.n);
  const start = user ? 1 : 0;

  // 1 — answers and traits
  const drafts: Omit<PersonProfile, "v0" | "alpha" | "bias">[] = [];
  if (user) drafts.push(user);
  for (let i = start; i < n; i++) {
    const piety = pietyForMix(params.mix, i, n, rand);
    const leaves: PollLeaf[] = [];
    for (const cat of CATEGORIES) {
      leaves.push(
        // Scores from the walk are placeholders; every answer is re-scored in pass 3.
        walkTreeRandom(cat.id, "individualistic", rand, piety, NO_TABLE),
        walkTreeRandom(cat.id, "communal", rand, piety * 0.85, NO_TABLE),
      );
    }
    drafts.push({
      id: `a-${i}`,
      name: agentName(i, rand),
      settling: 0.55 + rand() * 1.05,
      clump: 0.25 + rand() * 0.7,
      leadership: clamp(0.35 + randn(rand) * 0.25 + piety * 0.1, 0.08, 1),
      // Base only: the swayability nudge is applied in pass 4.
      stubbornness: clamp(0.2 + rand() * 0.55 + Math.abs(piety) * 0.15, 0.05, 0.9),
      extroversion: clamp(0.35 + rand() * 1.3, 0.2, 1.8),
      leaves,
    });
  }

  // 2 — social consensus, once, from the starting answers
  const consensus = computeConsensus(drafts.map((d) => d.leaves));

  // 3 — score every answer from its weight equation
  const sway = swayMultiplier(params.stubbornnessScale);
  const scored = drafts.map((d) => {
    const leaves = d.leaves.map((leaf) => ({
      ...leaf,
      score: answerScore(leaf, equations, consensus),
    }));
    const v0: number[] = [];
    const alpha: number[] = [];
    const bias: number[] = [];
    let rawAlphaSum = 0;
    for (const cat of CATEGORIES) {
      const ind = leaves.find((l) => l.categoryId === cat.id && l.mode === "individualistic");
      const com = leaves.find((l) => l.categoryId === cat.id && l.mode === "communal");
      const indScore = ind?.score ?? 0;
      const comScore = com?.score ?? 0;
      v0.push(clamp(indScore, SCORE_MIN, SCORE_MAX));
      // α and the yield asymmetry both come from the distance between this person's
      // own two answers in this category — see `socialCoefficients`.
      const sc = socialCoefficients(indScore, comScore, sway);
      alpha.push(sc.alpha);
      bias.push(sc.bias);
      rawAlphaSum += socialCoefficients(indScore, comScore, 1).alpha;
    }
    return { draft: d, leaves, v0, alpha, bias, meanAlpha: rawAlphaSum / CATEGORIES.length };
  });

  // 4 — stubbornness nudged by swayability relative to this population
  const reference = median(scored.map((s) => s.meanAlpha));
  const people: PersonProfile[] = scored.map((s) => ({
    ...s.draft,
    leaves: s.leaves,
    v0: s.v0,
    alpha: s.alpha,
    bias: s.bias,
    stubbornness: stubbornnessFromAlpha(s.draft.stubbornness, s.meanAlpha, reference),
  }));

  return { people, consensus };
}

/**
 * Next person to join a meeting, drawn with probability proportional to their tie
 * with the person who started it, boosted by clumping, a shared topic history and
 * their own sociability. People already in the meeting are skipped. Returns −1 when
 * nobody is left to draw.
 */
function pickPartner(
  i: number,
  n: number,
  w: number[][],
  lastCat: number[][],
  clump: number[],
  clumpK: number,
  ext: number[],
  taken: Uint8Array,
  rand: () => number,
) {
  const weights: number[] = [];
  let sum = 0;
  for (let j = 0; j < n; j++) {
    if (taken[j]) {
      weights.push(0);
      continue;
    }
    const base = (w[i]![j] || 0.04) * (1 + clumpK * 0.5 * (clump[i]! + clump[j]!));
    const boost = lastCat[i]![j]! >= 0 ? 1 + clump[i]! * clumpK : 1;
    const ww = base * boost * (0.5 + 0.5 * ext[j]!);
    weights.push(ww);
    sum += ww;
  }
  if (sum <= 0) return -1;
  let r = rand() * sum;
  for (let j = 0; j < n; j++) {
    r -= weights[j]!;
    if (r <= 0 && !taken[j]) return j;
  }
  return -1;
}

export function runSimulation(
  people: PersonProfile[],
  params: SimParams,
  consensus?: ConsensusTable,
): SimSnapshot {
  const rand = mulberry32(params.seed ^ 0x9e3779b9);
  const n = people.length;
  const C = CATEGORY_IDS.length;
  const v = people.map((p) => p.v0.slice());
  const v0 = people.map((p) => p.v0.slice());
  const alpha = people.map((p) => p.alpha.slice());
  const bias = people.map((p) => p.bias.slice());
  const settling = people.map((p) => p.settling);
  const clump = people.map((p) => p.clump);
  const lead = people.map((p) => p.leadership);
  const stub = people.map((p) => p.stubbornness);
  const ext = people.map((p) => p.extroversion);

  const w: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const lastCat: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rand() < params.initDensity) {
        const ww = 0.15 + rand() * 0.5;
        w[i]![j] = ww;
        w[j]![i] = ww;
      }
    }
  }

  const history: HistoryPoint[] = [];
  const record = (t: number) => {
    const means = Array(C).fill(0);
    const stds = Array(C).fill(0);
    for (let c = 0; c < C; c++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += v[i]![c]!;
      means[c] = s / n;
      let q = 0;
      for (let i = 0; i < n; i++) {
        const d = v[i]![c]! - means[c]!;
        q += d * d;
      }
      stds[c] = Math.sqrt(q / n);
    }
    history.push({
      t,
      means,
      stds,
      overall: means.reduce((a, b) => a + b, 0) / C,
    });
  };

  record(0);
  let meetings = 0;
  let participants = 0;
  const clumpK = params.clumpStrength;
  const width = params.confidenceWidth;
  const rho = params.repulsion;
  // Both halves of the swayability rule come from the one control: alpha was already
  // damped by `swayMultiplier` when the population was built, and the restoring pull
  // is derived from the same number here.
  const anchor = anchorStrength(params.stubbornnessScale);
  const halfLife = params.plasticityHalfLife;
  const groupDecay = clamp(params.groupDecay ?? 0, 0, GROUP_DECAY_MAX);

  const order = Array.from({ length: n }, (_, i) => i);
  const taken = new Uint8Array(n);
  const group: number[] = [];
  const before: number[] = [];
  const after: number[] = [];

  for (let t = 1; t <= params.steps; t++) {
    // Plasticity is a property of elapsed time, not of how much socialising a person
    // has done, so it is computed once per step and shared by every interaction in it.
    const plast = people.map((_, i) => plasticityAt(t, halfLife, settling[i]!));

    for (let a = n - 1; a > 0; a--) {
      const b = Math.floor(rand() * (a + 1));
      const tmp = order[a]!;
      order[a] = order[b]!;
      order[b] = tmp;
    }

    for (const i of order) {
      const want = poisson(rand, params.extroversion * ext[i]!);
      for (let m = 0; m < want; m++) {
        // Meeting size: 2, then each further member with probability `groupDecay`,
        // i.e. P(size) = (1 − q)·q^(size − 2) — a geometric distribution truncated at
        // the population. At q = 0 no draw is spent, so a run is identical to the
        // one-on-one model.
        let size = 2;
        if (groupDecay > 0) while (size < n && rand() < groupDecay) size++;

        group.length = 0;
        group.push(i);
        taken[i] = 1;
        while (group.length < size) {
          const j = pickPartner(i, n, w, lastCat, clump, clumpK, ext, taken, rand);
          if (j < 0) break;
          group.push(j);
          taken[j] = 1;
        }
        if (group.length < 2) {
          taken[i] = 0;
          continue;
        }
        const g = group.length;

        // Topic: whatever the starter and their first partner discussed last time.
        const first = group[1]!;
        let c = lastCat[i]![first]!;
        if (c < 0 || rand() > 0.55 + 0.35 * ((clump[i]! + clump[first]!) / 2) * clumpK) {
          c = Math.floor(rand() * C);
        }

        // Everyone updates at once, from where the group stood when it met.
        before.length = 0;
        for (const k of group) before.push(v[k]![c]!);

        for (let a = 0; a < g; a++) {
          const k = group[a]!;
          const vk = before[a]!;
          // Hegselmann–Krause local average, with the soft kernel in place of a hard
          // confidence bound: each other member's pull is weighted by w(Δ), and the
          // total is divided by how many people actually registered, Σ|w(Δ)|. Someone
          // tuned out does not dilute the pull of the people who were heard. The
          // divisor never drops below 1, so a lone faint signal is not amplified, and
          // for two people (|w| ≤ 1) it is exactly 1 — the one-on-one rule unchanged.
          let pull = 0;
          let heard = 0;
          for (let b = 0; b < g; b++) {
            if (b === a) continue;
            const other = group[b]!;
            const gap = before[b]! - vk;
            const wgt = influence(gap, width, rho);
            // Yield asymmetry: sign(gap) says whether this member is the stricter or
            // the more permissive one; k's own bias says which direction k gives in.
            const dir = gap === 0 ? 0 : Math.sign(gap);
            pull += (0.45 + 0.55 * lead[other]!) * (1 + bias[k]![c]! * dir) * wgt * gap;
            heard += Math.abs(wgt);
          }
          const rate = alpha[k]![c]! * plast[k]! * (1 - stub[k]!);
          // Social pull, then a restoring pull back toward the person's own starting
          // conviction (Friedkin–Johnsen). The fixed point is a blend, not consensus.
          after[a] = clamp(
            vk + (rate * pull) / Math.max(1, heard) - anchor * (vk - v0[k]![c]!),
            SCORE_MIN,
            SCORE_MAX,
          );
        }

        for (let a = 0; a < g; a++) v[group[a]!]![c] = after[a]!;

        // Ties: each pair in the meeting gets closer, by a share of what a one-on-one
        // would give — time in a group of g is split among g − 1 other people.
        const tie = (0.08 * clumpK) / (g - 1);
        for (let a = 0; a < g; a++) {
          for (let b = a + 1; b < g; b++) {
            const x = group[a]!;
            const y = group[b]!;
            const nw = Math.min(2.5, (w[x]![y] || 0.08) + tie);
            w[x]![y] = nw;
            w[y]![x] = nw;
            lastCat[x]![y] = c;
            lastCat[y]![x] = c;
          }
        }

        for (const k of group) taken[k] = 0;
        meetings += 1;
        participants += g;
      }
    }
    if (t % Math.max(1, Math.floor(params.steps / 24)) === 0 || t === params.steps) {
      record(t);
    }
  }

  const edges: EdgeRec[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if ((w[i]![j] || 0) > 0.12) {
        edges.push({
          i,
          j,
          w: w[i]![j]!,
          lastCategory: lastCat[i]![j]!,
        });
      }
    }
  }

  return {
    params,
    names: people.map((p) => p.name),
    isUser: people.map((p) => !!p.isUser),
    v0,
    v,
    alpha,
    history,
    edges,
    interactions: meetings,
    categoryIds: CATEGORY_IDS.slice(),
    meanGroupSize: meetings ? participants / meetings : 0,
    consensus,
  };
}
