import type { CategoryDef, LeafWeights, Likert, Mode, TreeNode } from "./types";
import { SPECTRA } from "./spectra";

/**
 * Tree geometry.
 *
 * Every question has four distinct follow-ups, one per answer, so the walk narrows the
 * candidate range to a quarter each time rather than to a half. Five questions over a
 * four-way split localise a person to 1 of 4^4 = 256 endings, against 64 for the seven
 * binary questions this replaced — a finer reading from fewer questions.
 *
 *   layer 0        1 question     index 0
 *   layer 1        4              1 – 4
 *   layer 2       16              5 – 20
 *   layer 3       64             21 – 84
 *   layer 4      256             85 – 340   (leaves — these carry the scores)
 *                ---
 *                341 nodes
 *
 * Layer L begins at index (4^L − 1) / 3, which is where LEAF_START comes from.
 */
export const TREE_ARITY = 4;
export const TREE_SIZE = 341;
export const TREE_DEPTH = 4;
export const LEAF_START = 85;
export const LEAF_COUNT = 256;

/**
 * Fixed categorical series colors, one per category, assigned in slot order and
 * never cycled. Stepped for the dark chart surface (#151613) and validated as a
 * set: every adjacent pair clears the CVD separation floor (worst ΔE 10.7,
 * deutan), the normal-vision floor (worst ΔE 17.9), and 3:1 contrast against the
 * surface. Re-validate the whole set if you change one — the ordering is the
 * colorblind-safety mechanism, not decoration.
 */
export const CATEGORY_COLORS = [
  "#4a8fd6", // blue
  "#cc6237", // terracotta
  "#1ba189", // teal
  "#b8871f", // gold
  "#cf6693", // magenta
  "#2c8c1f", // green
  "#9084dd", // violet
] as const;

export const CATEGORIES: CategoryDef[] = [
  {
    id: "alcohol",
    name: "Alcohol & substances",
    blurb: "Private use, intoxication, and how friends change the line.",
    color: CATEGORY_COLORS[0],
  },
  // NOTE: `id` is the storage key for every node, weight and saved poll answer in a
  // tree (`${id}:${mode}:${index}`). Display names have changed since these were first
  // written; the ids deliberately have not, so existing saved data stays readable.
  {
    id: "character",
    name: "Character",
    blurb:
      "Includes intrinsic love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, and self-control",
    color: CATEGORY_COLORS[1],
  },
  {
    id: "practice",
    name: "Religious Practices",
    blurb:
      "Includes practices like worship, prayer, studies, and overall involvement",
    color: CATEGORY_COLORS[2],
  },
  {
    id: "sex",
    name: "Relationships",
    blurb: "Includes dating, marriage, fidelity, and sexual behavior",
    color: CATEGORY_COLORS[3],
  },
  {
    id: "campus",
    name: "Hobbies",
    blurb:
      "Includes rest and recreation outside of work, and what fills those hours",
    color: CATEGORY_COLORS[4],
  },
  {
    id: "academics",
    name: "Academics",
    blurb: "Integrity, diligence, and how a class or cohort moves the line.",
    color: CATEGORY_COLORS[5],
  },
  {
    id: "work",
    name: "Work",
    blurb: "Honesty in money and labor, and how a workplace culture pulls.",
    color: CATEGORY_COLORS[6],
  },
];

export function categoryColor(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.color ?? "#8f8e86";
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function categoryIndex(id: string) {
  return CATEGORY_IDS.indexOf(id);
}

/**
 * Index of the child reached by answer `slot`, where slot is the answer's position in
 * `LIKERTS`: 0 = strongly agree … 3 = strongly disagree. Slot 0 leads to the strictest
 * quarter of what remains, slot 3 to the most permissive.
 */
export function childIndex(i: number, slot: number) {
  const c = TREE_ARITY * i + 1 + slot;
  return c < TREE_SIZE ? c : null;
}

/** All four children in answer order, or [] for a leaf. */
export function childrenOf(i: number): number[] {
  if (isLeafIndex(i)) return [];
  const out: number[] = [];
  for (let slot = 0; slot < TREE_ARITY; slot++) {
    const c = childIndex(i, slot);
    if (c != null) out.push(c);
  }
  return out;
}

export function isLeafIndex(i: number) {
  return i >= LEAF_START;
}

/**
 * The span of leaves reachable from node `i`, as leaf indices. Descending through the
 * first child repeatedly gives the strictest reachable ending, through the last child
 * the most permissive; the midpoint of that span is what the node's statement is drawn
 * from, so a question always sits in the middle of the range it is deciding between.
 */
export function leafRange(i: number): [number, number] {
  let lo = i;
  let hi = i;
  while (lo < LEAF_START) lo = TREE_ARITY * lo + 1;
  while (hi < LEAF_START) hi = TREE_ARITY * hi + TREE_ARITY;
  return [lo - LEAF_START, hi - LEAF_START];
}

function defaultLeafWeights(leafIndex: number): LeafWeights {
  const base = 10 - (leafIndex / (LEAF_COUNT - 1)) * 20;
  return {
    sa: round1(base + 1.6),
    a: round1(base + 0.5),
    d: round1(base - 0.5),
    sd: round1(base - 1.6),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Layer of node `i`: the L for which (4^L − 1)/3 ≤ i < (4^(L+1) − 1)/3. */
function depthOf(i: number) {
  let depth = 0;
  let start = 0;
  let width = 1;
  while (i >= start + width) {
    start += width;
    width *= TREE_ARITY;
    depth += 1;
  }
  return depth;
}

function pickLine(lines: string[], t: number) {
  const x = Math.min(1, Math.max(0, t));
  const idx = Math.round(x * (lines.length - 1));
  return lines[idx]!;
}

export function buildTree(categoryId: string, mode: Mode): TreeNode[] {
  const lines = SPECTRA[`${categoryId}:${mode}`];
  if (!lines) throw new Error(`Missing spectrum ${categoryId}:${mode}`);
  const nodes: TreeNode[] = [];
  for (let i = 0; i < TREE_SIZE; i++) {
    const [lo, hi] = leafRange(i);
    const mid = (lo + hi) / 2 / (LEAF_COUNT - 1);
    const depth = depthOf(i);
    const leaf = isLeafIndex(i);
    const parent = i === 0 ? null : Math.floor((i - 1) / TREE_ARITY);
    nodes.push({
      id: `${categoryId}:${mode}:${i}`,
      index: i,
      depth,
      isLeaf: leaf,
      text: pickLine(lines, mid),
      children: childrenOf(i),
      parent,
      leafIndex: leaf ? i - LEAF_START : null,
      defaultWeights: leaf ? defaultLeafWeights(i - LEAF_START) : null,
    });
  }
  return nodes;
}

const TREE_CACHE = new Map<string, TreeNode[]>();

export function treeFor(categoryId: string, mode: Mode) {
  const k = `${categoryId}:${mode}`;
  let t = TREE_CACHE.get(k);
  if (!t) {
    t = buildTree(categoryId, mode);
    TREE_CACHE.set(k, t);
  }
  return t;
}

export function allTrees() {
  return CATEGORIES.flatMap((c) =>
    (["individualistic", "communal"] as const).map((mode) => ({
      categoryId: c.id,
      mode,
      nodes: treeFor(c.id, mode),
    })),
  );
}

/**
 * The question as it should be shown, honouring any edit made on the Weights page.
 *
 * Tree text is generated from `SPECTRA` at build time and cached, so an edit cannot
 * live on the node itself. Overrides are stored by node id in the app store and
 * resolved here, which keeps the Weights editor and the Poll reading from one place.
 * A blank or whitespace-only override falls back to the generated text rather than
 * leaving a question with no wording at all.
 */
export function questionText(
  node: Pick<TreeNode, "id" | "text">,
  overrides?: Record<string, string>,
) {
  const edited = overrides?.[node.id];
  return edited && edited.trim() ? edited : node.text;
}

export function findNode(id: string) {
  for (const cat of CATEGORIES) {
    for (const mode of ["individualistic", "communal"] as const) {
      const hit = treeFor(cat.id, mode).find((n) => n.id === id);
      if (hit) return { cat, mode, node: hit };
    }
  }
  return null;
}

export function defaultWeightsMap() {
  const out: Record<string, LeafWeights> = {};
  for (const cat of CATEGORIES) {
    for (const mode of ["individualistic", "communal"] as const) {
      for (const n of treeFor(cat.id, mode)) {
        if (n.isLeaf && n.defaultWeights) out[n.id] = { ...n.defaultWeights };
      }
    }
  }
  return out;
}

export function scoreFromWeights(
  weights: LeafWeights | null | undefined,
  likert: Likert,
  fallback: LeafWeights,
) {
  return (weights ?? fallback)[likert];
}
