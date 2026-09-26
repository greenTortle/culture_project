import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATEGORIES, questionText, treeFor } from "./catalog";
import {
  QUESTIONS_PER_TREE,
  childFor,
  socialCoefficients,
  swayMultiplier,
  startWalk,
  treeOrder,
  type WalkState,
} from "./poll";
import { placeholderWeight } from "./severity";
import { runSimulation, synthesizePopulation } from "./simulate";
import type {
  LeafEquations,
  Likert,
  PersonProfile,
  PollLeaf,
  SimParams,
  SimSnapshot,
  WeightEquation,
} from "./types";

const defaultParams: SimParams = {
  n: 48,
  steps: 80,
  extroversion: 1,
  seed: 7,
  clumpStrength: 0.7,
  initDensity: 0.08,
  stubbornnessScale: 1,
  confidenceWidth: 12,
  repulsion: 0.15,
  plasticityHalfLife: 15,
  groupDecay: 0.3,
  mix: "mixed",
};

interface PollRuntime {
  treeIdx: number;
  walk: WalkState;
  lastLikert: Likert | null;
  leaves: PollLeaf[];
  name: string;
}

interface AppState {
  /**
   * Edited question wording, by node id. Sparse: a node absent here shows the text
   * generated from `SPECTRA`. Read through `questionText()` so the Weights editor and
   * the Poll never disagree about what a question says.
   */
  questions: Record<string, string>;
  /**
   * Weight equations by leaf id, then answer. Sparse: an answer with nothing entered is
   * absent. Holds the authored inputs only — SC is measured per run, so no weight
   * value is ever stored here.
   */
  equations: Record<string, LeafEquations>;
  params: SimParams;
  poll: PollRuntime | null;
  user: PersonProfile | null;
  snapshot: SimSnapshot | null;
  running: boolean;
  setQuestionText: (id: string, text: string) => void;
  resetQuestions: () => void;
  setAnswerEquation: (leafId: string, likert: Likert, patch: Partial<WeightEquation>) => void;
  clearAnswerEquation: (leafId: string, likert: Likert) => void;
  resetEquations: () => void;
  setParams: (p: Partial<SimParams>) => void;
  startPoll: (name: string) => void;
  answer: (likert: Likert) => void;
  clearUser: () => void;
  run: () => void;
}

function profileFromLeaves(
  name: string,
  leaves: PollLeaf[],
  params: SimParams,
): PersonProfile {
  const v0: number[] = [];
  const alpha: number[] = [];
  const bias: number[] = [];
  for (const cat of CATEGORIES) {
    const ind = leaves.find((l) => l.categoryId === cat.id && l.mode === "individualistic");
    const com = leaves.find((l) => l.categoryId === cat.id && l.mode === "communal");
    v0.push(ind?.score ?? 0);
    const sc = socialCoefficients(
      ind?.score ?? 0,
      com?.score ?? 0,
      swayMultiplier(params.stubbornnessScale),
    );
    alpha.push(sc.alpha);
    bias.push(sc.bias);
  }
  return {
    id: "user",
    name: name || "You",
    isUser: true,
    v0,
    alpha,
    bias,
    settling: 1,
    clump: 0.55,
    leadership: 0.5,
    stubbornness: 0.4,
    extroversion: 1,
    leaves,
  };
}

export const useLine = create<AppState>()(
  persist(
    (set, get) => ({
      questions: {},
      equations: {},
      params: defaultParams,
      poll: null,
      user: null,
      snapshot: null,
      running: false,
      setQuestionText: (id, text) =>
        set((s) => {
          const next = { ...s.questions };
          // Storing a blank would leave the question with no wording; drop the key
          // instead so it falls back to the generated text.
          if (text.trim()) next[id] = text;
          else delete next[id];
          return { questions: next };
        }),
      resetQuestions: () => set({ questions: {} }),
      setAnswerEquation: (leafId, likert, patch) =>
        set((s) => {
          const merged: WeightEquation = { ...s.equations[leafId]?.[likert], ...patch };
          // An explicit `undefined` (or a non-number) in the patch clears that input.
          const cleaned: WeightEquation = {};
          for (const key of ["wPmc", "wPx", "wSc", "pmc"] as const) {
            const value = merged[key];
            if (typeof value === "number" && Number.isFinite(value)) cleaned[key] = value;
          }
          if (merged.px) cleaned.px = merged.px;
          const leaf: LeafEquations = { ...s.equations[leafId] };
          if (Object.keys(cleaned).length) leaf[likert] = cleaned;
          else delete leaf[likert];
          const next = { ...s.equations };
          if (Object.keys(leaf).length) next[leafId] = leaf;
          else delete next[leafId];
          return { equations: next };
        }),
      clearAnswerEquation: (leafId, likert) =>
        set((s) => {
          const leaf: LeafEquations = { ...s.equations[leafId] };
          delete leaf[likert];
          const next = { ...s.equations };
          if (Object.keys(leaf).length) next[leafId] = leaf;
          else delete next[leafId];
          return { equations: next };
        }),
      resetEquations: () => set({ equations: {} }),
      setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
      startPoll: (name) => {
        set({
          poll: {
            treeIdx: 0,
            walk: startWalk(),
            lastLikert: null,
            leaves: [],
            name,
          },
          user: null,
        });
      },
      answer: (likert) => {
        const { poll, params, questions } = get();
        if (!poll) return;
        const order = treeOrder();
        const cur = order[poll.treeIdx];
        if (!cur) return;
        const nodes = treeFor(cur.categoryId, cur.mode);
        const node = nodes[poll.walk.nodeIndex]!;
        const asked = [...poll.walk.asked, { statementId: node.id, likert }];
        if (node.isLeaf) {
          const leaf: PollLeaf = {
            categoryId: cur.categoryId,
            mode: cur.mode,
            statementId: node.id,
            statementText: questionText(node, questions),
            likert,
            // Provisional: the real score needs this answer's equation and the SC of a
            // population, so it is computed when a run starts (see `answerScore`).
            score: placeholderWeight({ categoryId: cur.categoryId, mode: cur.mode, nodeIndex: node.index }, likert),
            nodeIndex: node.index,
            asked,
          };
          const leaves = [...poll.leaves, leaf];
          const nextIdx = poll.treeIdx + 1;
          if (nextIdx >= order.length) {
            set({ poll: null, user: profileFromLeaves(poll.name, leaves, params) });
            return;
          }
          set({
            poll: {
              ...poll,
              treeIdx: nextIdx,
              walk: startWalk(),
              lastLikert: null,
              leaves,
            },
          });
          return;
        }
        set({
          poll: {
            ...poll,
            walk: { nodeIndex: childFor(poll.walk.nodeIndex, likert), asked },
            lastLikert: likert,
          },
        });
      },
      clearUser: () => set({ user: null, poll: null }),
      run: () => {
        const { equations, params, user } = get();
        set({ running: true });
        // The poll-taker's answers are re-scored inside `synthesizePopulation`, from the
        // weight equations as they stand right now and the social consensus of this
        // run's population, so edits on the Weights page take effect without retaking
        // the poll.
        const seeded = user
          ? {
              ...user,
              extroversion: user.extroversion ?? 1,
              settling: user.settling ?? 1,
            }
          : null;
        const population = synthesizePopulation(params, equations, seeded);
        const snapshot = runSimulation(population.people, params, population.consensus);
        set({ snapshot, running: false });
      },
    }),
    {
      // Bumped from v3: the trees went from 127 binary nodes to 341 four-way ones, so
      // every leaf id changed. A stored v3 weights table would key entries that no
      // longer exist while leaving the 256 real leaves unset, and a stored poll profile
      // would point at leaf ids outside the new tree.
      name: "line-culture-lab-v4",
      partialize: (s) => ({
        questions: s.questions,
        equations: s.equations,
        params: s.params,
        user: s.user,
        snapshot: s.snapshot,
      }),
      // Shallow-merge would let a stored `params` object replace the defaults wholesale
      // and silently drop any key added since it was written. Fill the gaps instead.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          user: p.user ?? null,
          snapshot: p.snapshot ?? null,
          params: { ...defaultParams, ...(p.params ?? {}) },
          // Written by a build that predates editable questions, so it may be absent.
          questions: p.questions ?? {},
          // Likewise predates weight equations. Stores from older builds may also hold a
          // hand-typed `weights` table or per-leaf `severity` ratings; both are replaced
          // by equations and deliberately not carried over.
          equations: p.equations ?? {},
        };
      },
    },
  ),
);

export { QUESTIONS_PER_TREE, defaultParams };
