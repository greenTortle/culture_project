import { influence } from "./poll";
import { expectedGroupSize } from "./simulate";
import type { SimParams } from "./types";

/**
 * Metadata for the Lab controls.
 *
 * Every control needs three things to be usable: a stated range, a plain-English
 * note on what it changes, and a live line underneath saying what the current
 * value means in practice. The wording here is deliberately non-technical — the
 * quantitative detail lives in the model write-up further down the Lab page, and
 * in the source comments in `simulate.ts` and `poll.ts`.
 *
 * Population averages of the private traits drawn in `synthesizePopulation`,
 * measured over a 4,000-person draw:
 *   clump         0.25 – 0.95   mean ~0.60
 *   extroversion  0.20 – 1.80   mean ~1.00
 *   settling      0.55 – 1.60   mean ~1.06
 *   stubbornness  0.05 – 0.90   mean ~0.52
 *   leadership    0.08 – 1.00   mean ~0.37
 */

/** Median score difference between two random people in the same category. */
const MEDIAN_PAIR_GAP = 5.9;

/** Breadth of the repulsive lobe in `influence`, needed for the crossover point. */
const REPEL_BREADTH = 2.5;

/** Widest possible disagreement: the full -12 to +12 span. */
const MAX_GAP = 24;

/** A labelled point on a parameter's range, shown as a scale under the control. */
export interface Anchor {
  at: number;
  label: string;
}

export interface NumericParamDef {
  key: NumericParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Unit shown next to the value, e.g. "people". Empty for pure multipliers. */
  unit?: string;
  /** What the number actually does inside the model. */
  info: string;
  /** Low / mid / high reference points, in range order. */
  anchors: Anchor[];
  /** Live interpretation of the current value. */
  describe: (p: SimParams) => string;
  /** Input type: "slider" (default) or "number" for a plain numeric field. */
  inputType?: "slider" | "number";
}

export type NumericParamKey =
  | "n"
  | "steps"
  | "extroversion"
  | "clumpStrength"
  | "initDensity"
  | "stubbornnessScale"
  | "confidenceWidth"
  | "repulsion"
  | "plasticityHalfLife"
  | "groupDecay"
  | "seed";

/**
 * Meetings a person takes part in per step. Everyone starts `extroversion` meetings on
 * average and each holds `expectedGroupSize` people, so each person is in
 * extroversion × mean size of them — 2 × extroversion when every meeting is a pair.
 */
function meetingsPerStep(p: SimParams) {
  return p.extroversion * expectedGroupSize(p.groupDecay ?? 0);
}

/** Probability that a meeting has exactly `size` people (ignoring the population cap). */
function groupSizeChance(q: number, size: number) {
  return (1 - q) * Math.pow(q, size - 2);
}

function pct(x: number) {
  if (x >= 0.995) return "100%";
  if (x < 0.001) return "<0.1%";
  return x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`;
}

/**
 * Step past which nothing meaningful can still change. Openness halves every
 * `plasticityHalfLife` steps, so by four half-lives a person keeps a sixteenth of
 * what they started with and the run is effectively over.
 */
export function settledStep(p: SimParams) {
  return Math.round(4 * p.plasticityHalfLife);
}

/**
 * Where the influence kernel crosses zero — beyond this distance, meeting someone
 * pushes you away instead of pulling you in.
 */
function repulsionCrossover(p: SimParams) {
  if (p.repulsion <= 0) return Infinity;
  const x2 = Math.log(p.repulsion / (1 + p.repulsion)) / (1 / REPEL_BREADTH ** 2 - 1);
  return Math.sqrt(Math.max(0, x2)) * p.confidenceWidth;
}

/** Pick the phrase whose threshold the value falls under. */
function band<T>(value: number, cuts: [number, T][], last: T): T {
  for (const [at, phrase] of cuts) if (value <= at) return phrase;
  return last;
}

export const NUMERIC_PARAMS: NumericParamDef[] = [
  {
    key: "n",
    label: "Population",
    min: 8,
    max: 120,
    step: 1,
    unit: "people",
    info:
      "How many people are in the simulated community, including you if you took the poll. Anyone can end up talking to anyone, so a bigger group means more possible friendships but a smaller chance of running into any particular person.",
    anchors: [
      { at: 8, label: "a small group" },
      { at: 48, label: "a hall or cohort" },
      { at: 120, label: "a large club" },
    ],
    describe: (p) =>
      `${p.n} people. ${band(
        p.n,
        [
          [20, "Small enough that everyone ends up knowing everyone."],
          [70, "Big enough for separate friend groups to form."],
        ],
        "Large enough that most people never meet most of the others.",
      )}`,
  },
  {
    key: "steps",
    label: "Time steps",
    min: 10,
    max: 300,
    step: 1,
    unit: "steps",
    info:
      "How long the season runs. Each step is one round in which everyone strikes up a few conversations. Nobody leaves — but people gradually become harder to change, so later rounds do less and less.",
    anchors: [
      { at: 10, label: "a few weeks" },
      { at: 80, label: "a full season" },
      { at: 300, label: "years" },
    ],
    describe: (p) => {
      const s = settledStep(p);
      const meetings = Math.round(p.n * p.steps * p.extroversion);
      const verdict =
        p.steps > s * 1.4
          ? "That is well past the point where people have stopped changing, so the extra rounds do almost nothing."
          : p.steps < s * 0.7
            ? "The season ends while people are still changing — you are seeing a culture mid-formation."
            : "That is about long enough for people to finish settling.";
      return `Roughly ${meetings.toLocaleString()} conversations in total. ${verdict}`;
    },
  },
  {
    key: "extroversion",
    label: "Extroversion",
    min: 0.1,
    max: 3,
    step: 0.05,
    info:
      "How sociable the community is overall. Everyone still differs — some people are naturally quiet and some are always talking — but this shifts the whole group up or down together.",
    anchors: [
      { at: 0.1, label: "keep to themselves" },
      { at: 1, label: "normally sociable" },
      { at: 3, label: "constantly together" },
    ],
    describe: (p) => {
      const each = meetingsPerStep(p);
      return `About ${each.toFixed(1)} ${each < 1.5 ? "conversation" : "conversations"} per person per round. ${band(
        p.extroversion,
        [
          [0.4, "People rarely cross paths, so views spread slowly and unevenly."],
          [1.6, "A normal amount of contact — people meet regularly without living in each other's pockets."],
        ],
        "Very dense contact: almost everyone hears from someone every round.",
      )}`;
    },
  },
  {
    key: "confidenceWidth",
    label: "Polarization 1",
    min: 2,
    max: 24,
    step: 0.5,
    unit: "pts",
    info:
      "Tuning people out — the first of the two ways a community can stay divided. People take seriously those whose views are close to their own and quietly dismiss those who seem way off, so this sets how far apart two people can be before they stop affecting each other at all. Lower keeps groups apart by stopping them from hearing each other. The whole scale is 24 points wide, so 24 means nobody is ever dismissed.",
    anchors: [
      { at: 2, label: "only people who already agree" },
      { at: 12, label: "people who are roughly similar" },
      { at: 24, label: "everyone gets heard" },
    ],
    describe: (p) => {
      const typical = influence(MEDIAN_PAIR_GAP, p.confidenceWidth, p.repulsion);
      return band(
        p.confidenceWidth,
        [
          [5, "Only people who already broadly agree can influence each other. Groups that start apart stay apart."],
          [
            14,
            `Two people with fairly similar views affect each other normally; someone at the far end of the scale is mostly tuned out. A typical pair ${
              typical > 0.5 ? "still gets through to each other easily" : "gets through to each other only partly"
            }.`,
          ],
        ],
        "Almost nobody is dismissed — even people at opposite ends pull on each other, which drives the whole group toward one middle position.",
      );
    },
  },
  {
    key: "repulsion",
    label: "Polarization 2",
    min: 0,
    max: 0.5,
    step: 0.01,
    info:
      "Backfire — the second of the two ways a community can stay divided, and the stronger one. Where the first merely stops people hearing each other, this actively drives them apart: meeting someone whose view is recognisably far from yours pushes you further from them rather than pulling you closer. Kept deliberately mild by default — it is here because the effect is real, not because it should drive the result.",
    anchors: [
      { at: 0, label: "off — people only pull together" },
      { at: 0.15, label: "mild — a slight hardening" },
      { at: 0.5, label: "strong — sides dig in" },
    ],
    describe: (p) => {
      if (p.repulsion <= 0) {
        return "Off. Every conversation either brings two people closer or does nothing — nobody is ever pushed further apart.";
      }
      const cross = repulsionCrossover(p);
      if (cross >= MAX_GAP) {
        return "Set so mildly against the current listening range that two people would have to disagree more than the scale allows before either was pushed away. In practice it never happens.";
      }
      return band(
        p.repulsion,
        [
          [
            0.22,
            "People who are reasonably close still move toward each other; only clearly opposed pairs harden slightly. A background effect, not the main story.",
          ],
        ],
        "Strong enough that meetings between opposed people reliably drive them apart, so the community splits into camps that keep reinforcing themselves.",
      );
    },
  },
  {
    key: "plasticityHalfLife",
    label: "Belief Hardening",
    min: 2,
    max: 60,
    step: 1,
    unit: "steps",
    info:
      "People are most open early on and get harder to change as the season goes on. This sets how quickly that happens — the number of rounds it takes for someone to become half as easy to move as they were at the start. Individuals vary: some set in their ways sooner than others.",
    anchors: [
      { at: 2, label: "minds made up almost at once" },
      { at: 15, label: "a formative first stretch" },
      { at: 60, label: "open the whole time" },
    ],
    describe: (p) =>
      `People are half as easy to change by round ${p.plasticityHalfLife}, and have mostly stopped moving by round ${settledStep(p)}. ${band(
        p.plasticityHalfLife,
        [
          [6, "Whoever someone happens to meet first has an outsized effect on where they end up."],
          [25, "There is a real formative window early on, then things gradually firm up."],
        ],
        "People stay impressionable for the whole run, so late conversations matter as much as early ones.",
      )}`,
  },
  {
    key: "groupDecay",
    label: "Group size",
    min: 0,
    max: 0.8,
    step: 0.05,
    info:
      "How often conversations involve more than two people. Most meetings are pairs; each extra person is this many times less likely than the size before it, so a trio is rarer than a pair, a group of four rarer still, and a gathering of the whole community is practically impossible. The person who starts a meeting draws the others from people they know. Inside a group, each person moves toward the average of the members they actually take seriously, so a group can pull someone further than any one of its members would. 0 makes every meeting one-on-one.",
    anchors: [
      { at: 0, label: "one-on-one only" },
      { at: 0.3, label: "mostly pairs, some trios" },
      { at: 0.8, label: "large groups are common" },
    ],
    describe: (p) => {
      const q = p.groupDecay ?? 0;
      if (q <= 0) {
        return "Every meeting is exactly two people — the classic pairwise model.";
      }
      const mean = expectedGroupSize(q);
      return `Pairs ${pct(groupSizeChance(q, 2))}, trios ${pct(groupSizeChance(q, 3))}, fours ${pct(
        groupSizeChance(q, 4),
      )}, five or more ${pct(q ** 3)}. A meeting holds ${mean.toFixed(2)} people on average.`;
    },
  },
  {
    key: "clumpStrength",
    label: "Clumping",
    min: 0,
    max: 2,
    step: 0.05,
    info:
      "How much the past pulls on the present. Turned up, people keep going back to the same friends, keep talking about the same topics with them, and those ties strengthen every time. Turned down, every conversation is with whoever happens to be around.",
    anchors: [
      { at: 0, label: "no friend groups at all" },
      { at: 0.7, label: "loose friend groups" },
      { at: 2, label: "closed cliques" },
    ],
    describe: (p) => {
      if (p.clumpStrength === 0) {
        return "Nobody has friends as such — every conversation is with a randomly chosen person, and having met before makes no difference.";
      }
      return band(
        p.clumpStrength,
        [
          [0.4, "A weak pull toward familiar faces. The group stays fairly well mixed."],
          [1.1, "Recognisable friend groups form, but people still talk across them fairly often."],
        ],
        "Tight cliques. People mostly talk to the same handful of others all season, so a view can take hold in one group and never reach the rest.",
      );
    },
  },
  {
    key: "initDensity",
    label: "Population Familiarity",
    min: 0.02,
    max: 0.4,
    step: 0.01,
    info:
      "How many people already have some connection before the season starts. This is the seed the friend groups grow from: start everyone as strangers and the structure has to build itself, start them half-connected and almost anyone is a plausible conversation partner from day one.",
    anchors: [
      { at: 0.02, label: "all strangers" },
      { at: 0.08, label: "a few prior friends" },
      { at: 0.4, label: "everyone half-knows everyone" },
    ],
    describe: (p) => {
      const deg = (p.n - 1) * p.initDensity;
      return `Everyone starts out knowing about ${deg.toFixed(0)} of the other ${p.n - 1} people. ${band(
        deg,
        [
          [2.5, "Close to a room of strangers — who you happen to meet first shapes everything."],
          [10, "A handful of existing friendships to build on."],
        ],
        "A well-connected group from the outset, so views spread quickly and evenly.",
      )}`;
    },
  },
  {
    key: "stubbornnessScale",
    label: "Stubbornness to Change",
    min: 0,
    max: 2,
    step: 0.05,
    info:
      "How firmly people hold their views, covering both halves of what that means: how far someone moves toward whoever they are with, and how strongly they are pulled back toward the view they started the season with. Both come from this one control, because they are the same disposition. The baseline is what the poll measured — it asks each person what they would do and what they would do if a friend were involved, and the distance between those two answers is how swayable that person is. 1 leaves that as measured; higher makes everyone more set in their ways.",
    anchors: [
      { at: 0, label: "no attachment to your own view" },
      { at: 1, label: "as the poll measured" },
      { at: 2, label: "convictions barely budge" },
    ],
    describe: (p) => {
      const s = p.stubbornnessScale;
      if (s <= 0) {
        return "Nothing holds anyone to the view they arrived with, and everyone moves twice as far toward whoever they meet. The only possible ending is that the whole community agrees.";
      }
      return band(
        s,
        [
          [
            0.5,
            "People move much further toward each other than their answers suggested, and barely hold on to where they began. Expect the group to converge quickly.",
          ],
          [
            1.2,
            "People are as easy or hard to sway as their own poll answers implied, and keep a real pull back toward the view they arrived with.",
          ],
          [
            1.6,
            "Noticeably set in their ways: company moves people less than the poll suggested, and their original convictions pull harder.",
          ],
        ],
        "Convictions dominate. People barely move no matter whose company they keep, so the season ends close to where it started.",
      );
    },
  },
  {
    key: "seed",
    label: "Seed",
    min: 1,
    max: 9999,
    step: 1,
    inputType: "number",
    info:
      "Picks which random community gets generated — who exists, who starts out knowing whom, and who runs into whom. It is a label, not a quantity: 8 is not 'more' than 7. Keep it the same to replay a run exactly, change it to draw a fresh community with the same settings.",
    anchors: [],
    describe: (p) =>
      `Run #${p.seed}. Re-running with the same settings gives exactly this result again; change the number for a different community.`,
  },
];

/**
 * Display grouping for the Lab. Eleven controls in one flat grid gives no hint about
 * which knob affects what; these headings separate *how big the world is* from
 * *who meets whom* from *how much a meeting changes someone*.
 */
const GROUP_SPEC: { title: string; hint: string; keys: NumericParamKey[] }[] = [
  {
    title: "Population & time",
    hint: "How big the community is and how long the season runs.",
    keys: ["n", "steps"],
  },
  {
    title: "Who meets whom",
    hint: "How often people talk and how much they stick to the same company.",
    keys: ["extroversion", "groupDecay", "clumpStrength", "initDensity"],
  },
  {
    title: "How far a conversation moves someone",
    hint: "Who gets listened to, who gets dismissed, and what holds a person to the view they came in with.",
    keys: ["stubbornnessScale", "confidenceWidth", "repulsion", "plasticityHalfLife"],
  },
  { title: "Reproducibility", hint: "", keys: ["seed"] },
];

export interface ParamGroup {
  title: string;
  hint: string;
  params: NumericParamDef[];
}

/**
 * Grouped controls in display order. Anything defined but not placed in GROUP_SPEC
 * lands in a trailing "Other" group rather than silently disappearing from the page.
 */
export function paramGroups(): ParamGroup[] {
  const placed = new Set<NumericParamKey>();
  const groups: ParamGroup[] = GROUP_SPEC.map((g) => ({
    title: g.title,
    hint: g.hint,
    params: g.keys.flatMap((k) => {
      const def = NUMERIC_PARAMS.find((d) => d.key === k);
      if (!def) return [];
      placed.add(k);
      return [def];
    }),
  }));
  const orphans = NUMERIC_PARAMS.filter((d) => !placed.has(d.key));
  if (orphans.length) groups.push({ title: "Other", hint: "", params: orphans });
  return groups.filter((g) => g.params.length > 0);
}

export const MIX_OPTIONS: {
  value: SimParams["mix"];
  label: string;
  describe: string;
}[] = [
  {
    value: "homogeneous",
    label: "Homogeneous (devout-leaning)",
    describe:
      "Almost everyone starts in a similar, fairly devout place. There is little for anyone to converge toward — the culture starts roughly where it ends.",
  },
  {
    value: "mixed",
    label: "Mixed",
    describe:
      "Most people start somewhere in the middle, with a few at each end. The closest thing to a typical group.",
  },
  {
    value: "polarized",
    label: "Polarized",
    describe:
      "Two distinct camps, one devout and one permissive, with few people in between. Use the listening range to see whether they stay apart or collapse together.",
  },
  {
    value: "random",
    label: "Random",
    describe:
      "A wide scatter with no real centre. The most extreme individuals in the model come from here.",
  },
];

export function clampParam(def: NumericParamDef, raw: number) {
  if (!Number.isFinite(raw)) return def.min;
  return Math.min(def.max, Math.max(def.min, raw));
}
