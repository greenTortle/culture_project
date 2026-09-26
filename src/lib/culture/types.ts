export const LIKERTS = ["sa", "a", "d", "sd"] as const;
export type Likert = (typeof LIKERTS)[number];

export const LIKERT_LABEL: Record<Likert, string> = {
  sa: "Strongly Agree",
  a: "Agree",
  d: "Disagree",
  sd: "Strongly Disagree",
};

export type Mode = "individualistic" | "communal";

export type LeafWeights = Record<Likert, number>;

/**
 * Proximity (PX) tiers — Jones's (1991) "nearness" of the moral agent to the people
 * affected, one of the three moral-intensity factors that held up as distinct in
 * McMahon & Harvey’s (2006) factor analysis. Ordered far → near.
 */
export type ProximityTier = "society" | "community" | "acquaintances" | "close";

/**
 * The inputs that define one answer's weight at a scored question (one Likert option at
 * one leaf):
 *
 *   weight = wPmc · (PMC / 10) + wPx · PX + wSc · SC
 *
 * Every term in parentheses is on [0, 1], so each coefficient is the most score points
 * that term can contribute, and its sign carries the direction (positive = Biblical,
 * negative = sinful). Everything here is authored on the Weights page except SC, which
 * is measured from the population at the start of each run — so an equation can be
 * complete here without having a value yet. All fields are optional while it is being
 * filled in; see `missingInputs` in `severity.ts`.
 */
export interface WeightEquation {
  /** Coefficient on PMC. */
  wPmc?: number;
  /** Coefficient on PX. */
  wPx?: number;
  /** Coefficient on SC. */
  wSc?: number;
  /** Probable Magnitude of Consequences, 0–10 (magnitude × probability × immediacy). */
  pmc?: number;
  /** Proximity to those affected. */
  px?: ProximityTier;
}

/** The equations for a leaf's answers. Sparse: an answer with nothing entered is absent. */
export type LeafEquations = Partial<Record<Likert, WeightEquation>>;

/** Social consensus per tree (`${categoryId}:${mode}`), 0 = no agreement, 1 = unanimous. */
export type ConsensusTable = Record<string, number>;

export interface TreeNode {
  id: string;
  index: number;
  depth: number;
  isLeaf: boolean;
  text: string;
  /**
   * One child per answer, in `LIKERTS` order (strongly agree → strongly disagree).
   * Empty on a leaf. Every answer leads somewhere different, so the walk narrows by a
   * quarter each question rather than by a half.
   */
  children: number[];
  parent: number | null;
  leafIndex: number | null;
  defaultWeights: LeafWeights | null;
}

export interface CategoryDef {
  id: string;
  name: string;
  blurb: string;
  /** Fixed categorical series color. Bound to the category, never to its rank. */
  color: string;
}

export interface PollLeaf {
  categoryId: string;
  mode: Mode;
  statementId: string;
  statementText: string;
  likert: Likert;
  score: number;
  nodeIndex: number;
  asked: { statementId: string; likert: Likert }[];
}

export interface PersonProfile {
  id: string;
  name: string;
  isUser?: boolean;
  /** Starting score per category. Also the anchor the person is pulled back toward. */
  v0: number[];
  /** Per-category share of the gap closed toward a partner, before damping. */
  alpha: number[];
  /**
   * Per-category directional asymmetry, from the sign of the individualistic ↔ communal
   * gap. Negative = company pulls this person down more readily than up.
   */
  bias: number[];
  /**
   * How fast this person's impressionability decays, relative to the population
   * half-life. 1 = the norm; >1 sets in their convictions sooner. Replaces the old
   * fixed interaction budget.
   */
  settling: number;
  clump: number;
  leadership: number;
  /**
   * Resistance to company, 0.05–0.9. For synthetic people this is a random draw nudged
   * by piety and — once a run is built — by how swayable their own answers show them
   * to be relative to the rest of the population (`stubbornnessFromAlpha`). For a
   * poll-taker the stored value is the pre-nudge base; the nudge is re-applied per run.
   */
  stubbornness: number;
  extroversion: number;
  leaves: PollLeaf[];
}

export interface SimParams {
  n: number;
  steps: number;
  extroversion: number;
  seed: number;
  clumpStrength: number;
  initDensity: number;
  /**
   * Single dial governing how swayable people are, in BOTH directions it can be read:
   * how far someone moves toward whoever they meet, and how hard they are pulled back
   * toward the view they started with. Higher is more stubborn. 1 reproduces what the
   * poll measured. Resolved into its two effects by `swayMultiplier` and
   * `anchorStrength` in `poll.ts` — never read directly by the interaction loop.
   *
   * Distinct from `PersonProfile.stubbornness`, which is one person's private trait;
   * this scales the whole population.
   */
  stubbornnessScale: number;
  /** Score distance at which influence has fallen to ~37% (bounded confidence). */
  confidenceWidth: number;
  /** Strength of the far-field backfire lobe. 0 disables it entirely. */
  repulsion: number;
  /** Time steps over which impressionability halves. */
  plasticityHalfLife: number;
  /**
   * Ratio P(n + 1) / P(n) of meeting sizes, in [0, 1). Sizes follow a geometric
   * distribution starting at 2, so 0 means every meeting is one-on-one and each extra
   * member is this many times less likely than the size before it.
   */
  groupDecay: number;
  mix: "homogeneous" | "mixed" | "polarized" | "random";
}

export interface HistoryPoint {
  t: number;
  means: number[];
  stds: number[];
  overall: number;
}

export interface EdgeRec {
  i: number;
  j: number;
  w: number;
  lastCategory: number;
}

export interface SimSnapshot {
  params: SimParams;
  names: string[];
  isUser: boolean[];
  v0: number[][];
  v: number[][];
  alpha: number[][];
  history: HistoryPoint[];
  edges: EdgeRec[];
  interactions: number;
  categoryIds: string[];
  /** Average number of people per meeting. Absent on runs saved by older builds. */
  meanGroupSize?: number;
  /** Social consensus per tree at t = 0. Absent on runs saved by older builds. */
  consensus?: ConsensusTable;
}
