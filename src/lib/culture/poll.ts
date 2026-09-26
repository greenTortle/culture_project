import { CATEGORIES, TREE_DEPTH, childIndex, isLeafIndex, treeFor } from "./catalog";
import { LIKERTS, type LeafWeights, type Likert, type Mode, type PollLeaf } from "./types";
import { pickLikert } from "./rng";

/** Layers 0…TREE_DEPTH inclusive, so five questions per tree. */
export const QUESTIONS_PER_TREE = TREE_DEPTH + 1;

export function treeOrder(): { categoryId: string; mode: Mode }[] {
  const out: { categoryId: string; mode: Mode }[] = [];
  for (const cat of CATEGORIES) {
    out.push({ categoryId: cat.id, mode: "individualistic" });
    out.push({ categoryId: cat.id, mode: "communal" });
  }
  return out;
}

/**
 * Where an answer leads.
 *
 * This is a threshold search, not four independent branches: the statement shown at
 * any node is a specific claim ("I would do X"), and agreeing with it — at ANY point
 * in the tree, whether that node's own statement reads as strict or permissive — means
 * "my line sits at or beyond this," because a person who would do something is, by
 * construction, at least that permissive. So agreeing must narrow toward the MORE
 * permissive quarter of what remains (confirming how far the "at least" extends), and
 * disagreeing must narrow toward the MORE strict quarter. `childIndex`'s slot order
 * runs strict → permissive (see catalog.ts), and `LIKERTS` runs strongly-agree →
 * strongly-disagree, i.e. the exact reverse — so the slot is `LIKERTS`' reversed index,
 * not its own index.
 *
 * Get this backwards and the search still runs to completion — every leaf is still
 * reachable — but it converges on the wrong end of a person's actual line, silently.
 *
 * Returns the node itself if the index is already a leaf, so a caller that keeps
 * walking cannot run off the end of the tree.
 */
export function childFor(index: number, likert: Likert) {
  const slot = LIKERTS.indexOf(likert);
  const reversed = slot < 0 ? 0 : LIKERTS.length - 1 - slot;
  return childIndex(index, reversed) ?? index;
}

export interface WalkState {
  nodeIndex: number;
  asked: { statementId: string; likert: Likert }[];
}

export function startWalk(): WalkState {
  return { nodeIndex: 0, asked: [] };
}

export function stepWalk(state: WalkState, likert: Likert): WalkState {
  return {
    nodeIndex: childFor(state.nodeIndex, likert),
    asked: state.asked,
  };
}

export function isWalkDone(state: WalkState) {
  return state.asked.length >= QUESTIONS_PER_TREE || isLeafIndex(state.nodeIndex);
}

export function leafScore(
  nodeId: string,
  likert: Likert,
  table: Record<string, LeafWeights>,
  fallback: LeafWeights,
) {
  return (table[nodeId] ?? fallback)[likert];
}

export function walkTreeRandom(
  categoryId: string,
  mode: Mode,
  rand: () => number,
  piety: number,
  table: Record<string, LeafWeights>,
): PollLeaf {
  const nodes = treeFor(categoryId, mode);
  let idx = 0;
  const asked: { statementId: string; likert: Likert }[] = [];
  let last: Likert = "a";
  while (true) {
    const node = nodes[idx]!;
    last = pickLikert(rand, piety);
    asked.push({ statementId: node.id, likert: last });
    if (node.isLeaf) break;
    idx = childFor(idx, last);
  }
  const leaf = nodes[idx]!;
  const fb = leaf.defaultWeights ?? { sa: 0, a: 0, d: 0, sd: 0 };
  return {
    categoryId,
    mode,
    statementId: leaf.id,
    statementText: leaf.text,
    likert: last,
    score: leafScore(leaf.id, last, table, fb),
    nodeIndex: idx,
    asked,
  };
}

/* ------------------------------------------------------------------ *
 * Social coefficients
 * ------------------------------------------------------------------ */

export const ALPHA_MIN = 0.04;
export const ALPHA_MAX = 0.85;

/**
 * Gap (in score points) at which a person is treated as maximally impressionable.
 * Leaf scores run about −11.6…+11.6, so the widest possible individualistic ↔
 * communal gap is ~23. 16 puts the α cap inside the observed range without
 * saturating the median: over a 28,000-leaf draw this yields α ≈ 0.06 / 0.37 /
 * 0.85 at the 10th / 50th / 90th percentile — a spread comparable to the sigmoid
 * it replaces, but with a genuinely immovable low tail.
 */
export const GAP_NORM = 16;

/** How far the yield asymmetry can tilt a single interaction. Deliberately modest. */
export const BIAS_CAP = 0.35;

/**
 * Pull back toward a person's own starting view, per interaction, at stubbornnessScale
 * = 1. Chosen so that the default reproduces the separately calibrated behaviour of the
 * anchor control this replaced.
 */
export const ANCHOR_PER_UNIT = 0.02;

/**
 * Being hard to move and clinging to where you began are one disposition, not two, so a
 * single control resolves into both halves of the update rule.
 *
 * Splitting them into separate controls let a run be configured incoherently — wide open
 * to persuasion yet immovably anchored, which is not a person — and made the two
 * settings silently cancel. They pull the same way here: turning stubbornness up damps
 * the movement toward whoever you meet AND strengthens the pull home.
 *
 * The multiplier is geometric so the control has no dead end: 0 doubles how far people
 * move, 1 is what the poll measured, 2 halves it. The anchor is linear from zero, so
 * stubbornness 0 means literally no memory of your own starting view, which is the
 * degenerate pure-consensus case worth being able to reach.
 */
export function swayMultiplier(stubbornnessScale: number) {
  return Math.pow(2, 1 - stubbornnessScale);
}

export function anchorStrength(stubbornnessScale: number) {
  return ANCHOR_PER_UNIT * Math.max(0, stubbornnessScale);
}

export interface SocialCoefficients {
  /** Share of the gap this person closes toward a partner, before damping. */
  alpha: number;
  /**
   * Directional asymmetry in [−BIAS_CAP, +BIAS_CAP]. Negative means company pulls
   * this person down more easily than up; positive means the reverse.
   */
  bias: number;
}

/**
 * Estimate a person's social susceptibility in one category from the WITHIN-SUBJECT
 * difference between their two poll answers.
 *
 * The poll already asks both "I would do X" (individualistic) and "I would do X if a
 * friend were" (communal). The distance between those two answers IS the quantity the
 * interaction rule needs: someone whose answer does not move when a friend is involved
 * is not impressionable, and someone whose answer swings is. Reading it this way makes
 * α a measured difference rather than an assumption.
 *
 * The previous estimator, α = sigmoid(−communal/8 × 1.4), mapped a *moral* score onto a
 * *plasticity*, so answering more Biblically on communal items automatically made a
 * person harder to move. That coupling was an untested premise smuggled in as an
 * identity, and it also discarded the sign of the gap — which is the informative half.
 *
 * `scale` is the global Impressionability control.
 */
export function socialCoefficients(
  indScore: number,
  comScore: number,
  scale: number,
): SocialCoefficients {
  const gap = comScore - indScore;
  const alpha = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, (Math.abs(gap) / GAP_NORM) * scale));
  const bias = Math.max(-1, Math.min(1, gap / GAP_NORM)) * BIAS_CAP;
  return { alpha, bias };
}

/* ------------------------------------------------------------------ *
 * Stubbornness, nudged by measured swayability
 * ------------------------------------------------------------------ */

/**
 * How strongly a person's measured swayability moves their stubbornness trait.
 * Calibrated so the nudge is the same order as the piety nudge it sits beside
 * (at most +0.15), and neither dominates: over a 4,000-person draw at default
 * settings the median mean-α is ≈0.35, and the 50th / 90th / 99th percentile
 * distance from it is ≈0.06 / 0.15 / 0.23 — so at k = 1 a typical person moves
 * ±0.06 and a person at the 90th percentile moves ±0.15.
 */
export const STUBBORNNESS_ALPHA_COUPLING = 1;

/**
 * Stubbornness adjusted by how swayable this person's own answers show them to be,
 * relative to the population they are in.
 *
 *   stubbornness = clamp(base − k · (meanα − median meanα), 0.05, 0.9)
 *
 * `meanAlpha` is the person's α averaged over every category, computed at scale 1
 * (before the Lab's Stubbornness control) so the global dial is not counted twice.
 * Someone whose answers move a lot once a friend is involved is showing low general
 * resistance, so above-median swayability lowers stubbornness and below-median raises
 * it. The reference is the population median rather than a fixed constant, so the
 * nudge describes a person relative to their peers and does not drift when the
 * weight table changes.
 *
 * This is the same move α itself makes: read a measured within-person gap as the
 * signal instead of assuming a trait. Only a nudge, not a replacement — the random
 * base stays, because the poll measures swayability per category, not a general
 * disposition.
 */
export function stubbornnessFromAlpha(
  base: number,
  meanAlpha: number,
  referenceAlpha: number,
) {
  const nudged = base - STUBBORNNESS_ALPHA_COUPLING * (meanAlpha - referenceAlpha);
  return Math.max(0.05, Math.min(0.9, nudged));
}

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/* ------------------------------------------------------------------ *
 * Influence kernel
 * ------------------------------------------------------------------ */

/**
 * Breadth of the repulsive lobe, as a multiple of the confidence width. Fixed rather
 * than exposed: it sets *where* backfire peaks (≈1.5× the confidence width), while the
 * `repulsion` parameter sets *how hard*. Two knobs for one shape is one too many.
 */
const REPEL_BREADTH = 2.5;

/**
 * How much of the gap actually transmits, as a function of how far apart the two people
 * are. A difference of Gaussians (the standard "Mexican hat"): a narrow attractive core
 * minus a broad shoulder.
 *
 *   w(Δ) = exp(−(Δ/d)²) − ρ · [exp(−(Δ/2.5d)²) − exp(−(Δ/d)²)]
 *
 * Three properties make this the right shape here:
 *
 *  1. w(0) = 1 for every ρ, so turning repulsion up never weakens agreement between
 *     people who already agree — it only adds a far-field effect.
 *  2. ρ = 0 collapses to pure bounded confidence, so the repulsion feature is strictly
 *     additive and can be switched off to isolate it.
 *  3. The bracketed term is ≥ 0 everywhere and peaks around Δ ≈ 1.5d, so backfire lives
 *     at *intermediate* distance — you bristle at the person who is recognisably wrong,
 *     not at the person whose world you cannot see. It decays to 0 at extreme distance,
 *     which is also what the evidence on attitude polarization suggests.
 *
 * At the default ρ = 0.15 the strongest repulsion is ≈ −0.06, i.e. about 6% of the
 * full-strength pull, reached near Δ = 2d. Small on purpose.
 */
export function influence(delta: number, width: number, repulsion: number) {
  const d = Math.max(0.25, width);
  const attract = Math.exp(-((delta / d) ** 2));
  const broad = Math.exp(-((delta / (REPEL_BREADTH * d)) ** 2));
  return attract - repulsion * (broad - attract);
}

/**
 * Fraction of a person's original impressionability still available at time t.
 * Replaces the old hard interaction budget — see `simulate.ts`.
 */
export function plasticityAt(t: number, halfLife: number, settling: number) {
  return Math.pow(0.5, (t * settling) / Math.max(0.5, halfLife));
}
