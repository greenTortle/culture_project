import { LEAF_COUNT, LEAF_START, treeFor } from "./catalog";
import type {
  ConsensusTable,
  LeafEquations,
  Likert,
  Mode,
  PollLeaf,
  ProximityTier,
  WeightEquation,
} from "./types";

/* ------------------------------------------------------------------ *
 * Answer weights from moral intensity
 *
 * Every answer at a scored question has its own weight equation:
 *
 *   weight = wPmc · (PMC / 10) + wPx · PX + wSc · SC
 *
 * The three quantities follow Jones's (1991) moral-intensity construct as trimmed by
 * McMahon & Harvey's (2006) factor analysis, which found only three of Jones's six
 * characteristics hold up as distinct:
 *
 *   PMC  Probable Magnitude of Consequences — magnitude, probability and temporal
 *        immediacy loaded on ONE factor, so they are rated as one number (0–10).
 *   PX   Proximity — how near the people affected are to the person acting.
 *   SC   Social consensus — how much the community agrees about the issue.
 *
 * Concentration of effect was dropped in that study for unreliable measurement and is
 * not modelled. The coefficients, PMC and PX are authored per answer on the Weights
 * page; SC is measured from the population at the start of each run, so the weight
 * itself only exists once a run begins.
 *
 * A weighted SUM rather than a product, because the three factors were found to be
 * distinct — a product would let one low factor wipe out the other two, which nothing
 * in that literature supports. How much each factor matters is left to the
 * coefficients rather than fixed here; neither Jones nor the follow-up work validates
 * particular values, and the defensible way to set them is empirically (e.g. a conjoint
 * study, as in Tsalikis, Seaton & Shepherd 2008).
 * ------------------------------------------------------------------ */

/** Upper end of the PMC rating scale. */
export const PMC_MAX = 10;

/** SC used only when a tree had fewer than two respondents to measure. */
export const NEUTRAL_CONSENSUS = 0.5;

/**
 * Proximity tiers, far → near. Jones defines proximity as nearness to those affected;
 * nearer victims make an act more intense, so `level` rises toward "close". Acts whose
 * consequences fall only on the actor sit outside Jones's construct — for those, the
 * PX coefficient can simply be set to 0.
 */
export const PROXIMITY_TIERS: {
  value: ProximityTier;
  label: string;
  level: number;
  hint: string;
}[] = [
  {
    value: "society",
    label: "Society at large",
    level: 0,
    hint: "Strangers, or people the actor will never meet.",
  },
  {
    value: "community",
    label: "Wider community",
    level: 1 / 3,
    hint: "Campus, church or town — people known of, not known.",
  },
  {
    value: "acquaintances",
    label: "Friends & acquaintances",
    level: 2 / 3,
    hint: "People the actor knows by name and sees regularly.",
  },
  {
    value: "close",
    label: "Close relationships",
    level: 1,
    hint: "Family, partner, roommates, closest friends.",
  },
];

/** The authored inputs of an equation, in the order they appear in it. */
export const EQUATION_INPUTS: { key: keyof WeightEquation; label: string }[] = [
  { key: "wPmc", label: "w_PMC" },
  { key: "pmc", label: "PMC" },
  { key: "wPx", label: "w_PX" },
  { key: "px", label: "PX" },
  { key: "wSc", label: "w_SC" },
];

export function treeKey(categoryId: string, mode: Mode) {
  return `${categoryId}:${mode}`;
}

export function proximityLevel(px: ProximityTier) {
  return PROXIMITY_TIERS.find((t) => t.value === px)?.level ?? 0;
}

function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Labels of the inputs still missing from an equation; empty when it is complete. */
export function missingInputs(eq: WeightEquation | undefined) {
  return EQUATION_INPUTS.filter(({ key }) => {
    const value = eq?.[key];
    if (key === "px") return !PROXIMITY_TIERS.some((t) => t.value === value);
    if (key === "pmc") return !isNum(value) || value < 0 || value > PMC_MAX;
    return !isNum(value);
  }).map((i) => i.label);
}

/** True when every authored input is present, so only SC is left to supply. */
export function isComplete(eq: WeightEquation | undefined): eq is Required<WeightEquation> {
  return missingInputs(eq).length === 0;
}

/** The answer's weight, given this run's SC for its tree. Null if the equation is incomplete. */
export function evaluateEquation(eq: WeightEquation | undefined, sc: number) {
  if (!isComplete(eq)) return null;
  return eq.wPmc * (eq.pmc / PMC_MAX) + eq.wPx * proximityLevel(eq.px) + eq.wSc * sc;
}

/**
 * The generated weight for an answer whose equation has not been filled in. Runs still
 * need a number for every answer, so these stand in — they are the original filler
 * weights, not derived from moral intensity.
 */
export function placeholderWeight(leaf: Pick<PollLeaf, "categoryId" | "mode" | "nodeIndex">, likert: Likert) {
  const node = treeFor(leaf.categoryId, leaf.mode)[leaf.nodeIndex];
  return node?.defaultWeights?.[likert] ?? 0;
}

/** Count of complete answer equations among `leafIds`, out of 4 per leaf. */
export function completedAnswers(equations: Record<string, LeafEquations>, leafIds: string[]) {
  let done = 0;
  for (const id of leafIds) {
    const eqs = equations[id];
    if (!eqs) continue;
    for (const eq of Object.values(eqs)) if (isComplete(eq)) done += 1;
  }
  return done;
}

/**
 * Social consensus per tree, measured once from where the population's answers
 * landed before anyone has interacted.
 *
 * Each respondent's line in a tree is the position of the leaf they reached, 0 at the
 * strictest ending and 1 at the most permissive. SC = 1 − σ / 0.5, where σ is the
 * population standard deviation of those positions and 0.5 is the largest σ possible
 * on [0, 1] (half the population at each end). Everyone at the same line gives SC = 1;
 * a community split evenly between the two extremes gives SC = 0.
 *
 * Positions rather than scores, because scores are computed FROM SC — measuring them
 * would make SC depend on itself.
 *
 * Measured per TREE (category × mode), not per individual question. A leaf is only ever
 * reached by people who already share a line — the walk selects for it — so agreement
 * among a leaf's respondents is agreement among the like-minded, not the community-wide
 * consensus Jones means. Every answer in a tree therefore uses its tree's SC.
 *
 * Fixed for the whole run: see "Known simplifications" on the Lab page.
 */
export function computeConsensus(respondents: PollLeaf[][]): ConsensusTable {
  const positions: Record<string, number[]> = {};
  for (const leaves of respondents) {
    for (const leaf of leaves) {
      if (leaf.nodeIndex < LEAF_START) continue;
      const key = treeKey(leaf.categoryId, leaf.mode);
      (positions[key] ??= []).push((leaf.nodeIndex - LEAF_START) / (LEAF_COUNT - 1));
    }
  }
  const out: ConsensusTable = {};
  for (const [key, xs] of Object.entries(positions)) {
    if (xs.length < 2) {
      out[key] = NEUTRAL_CONSENSUS;
      continue;
    }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
    out[key] = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 0.5));
  }
  return out;
}

/**
 * A poll answer's score for a run: its equation evaluated at this run's SC, or the
 * placeholder weight if the equation is not complete yet.
 */
export function answerScore(
  leaf: PollLeaf,
  equations: Record<string, LeafEquations>,
  consensus: ConsensusTable,
) {
  const sc = consensus[treeKey(leaf.categoryId, leaf.mode)] ?? NEUTRAL_CONSENSUS;
  const value = evaluateEquation(equations[leaf.statementId]?.[leaf.likert], sc);
  return value ?? placeholderWeight(leaf, leaf.likert);
}
