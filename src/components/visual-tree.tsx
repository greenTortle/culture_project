import { useState, type ReactNode } from "react";
import { ChevronLeft, RotateCcw, X } from "lucide-react";
import { LEAF_COUNT, TREE_DEPTH, questionText, treeFor } from "@/lib/culture/catalog";
import { childFor } from "@/lib/culture/poll";
import {
  PMC_MAX,
  PROXIMITY_TIERS,
  completedAnswers,
  missingInputs,
  placeholderWeight,
} from "@/lib/culture/severity";
import {
  LIKERT_LABEL,
  LIKERTS,
  type LeafEquations,
  type Likert,
  type Mode,
  type ProximityTier,
  type TreeNode,
  type WeightEquation,
} from "@/lib/culture/types";
import { cn } from "@/lib/cn";

/** Where the current node sits in the walk, plus the answer that got us there. */
interface Crumb {
  index: number;
  via: Likert | null;
}

/** Shared tint for all four answer boxes. */
const BRANCH_TONE =
  "border-accent/50 bg-accent/10 hover:border-accent hover:bg-accent/20";

/**
 * One question at a time, with its four answers below it.
 *
 * Each answer leads to its own follow-up question, narrowing the range to a quarter:
 * agreeing confirms "my line is at least this permissive" and takes the more
 * permissive quarter of what is left; disagreeing takes the stricter quarter (see
 * `childFor`). Destinations are read from `childFor` rather than assumed, and the four
 * boxes are laid out by where they actually lead (ascending child index, which is
 * always strict → permissive by construction — see catalog.ts) rather than by answer
 * order, so the UI cannot silently drift out of step with which answer goes which way.
 *
 * Only the current question is shown in full: showing the next layer's wording as
 * well made the page read as a wall of near-identical statements.
 */
export function VisualTree({
  categoryId,
  mode,
  questions,
  equations,
  onQuestionChange,
  onEquationChange,
  onEquationClear,
}: {
  categoryId: string;
  mode: Mode;
  questions: Record<string, string>;
  equations: Record<string, LeafEquations>;
  onQuestionChange: (id: string, text: string) => void;
  onEquationChange: (leafId: string, likert: Likert, patch: Partial<WeightEquation>) => void;
  onEquationClear: (leafId: string, likert: Likert) => void;
}) {
  const nodes = treeFor(categoryId, mode);
  const leafIds = nodes.filter((n) => n.isLeaf).map((n) => n.id);
  const ready = completedAnswers(equations, leafIds);
  const total = LEAF_COUNT * LIKERTS.length;
  const [path, setPath] = useState<Crumb[]>([{ index: 0, via: null }]);
  // Bumped by "Reset wording" to force the editor to re-seed its draft from the
  // generated text; the node id alone does not change, so it would otherwise keep
  // showing the edit that was just discarded.
  const [resetTick, setResetTick] = useState(0);

  const here = path[path.length - 1]!;
  const node = nodes[here.index]!;
  const text = questionText(node, questions);
  const edited = !!questions[node.id];

  // Group the four answers by the question each one leads to, then lay them out
  // strict → permissive by destination rather than by answer order — the two do not
  // coincide, since agreeing routes toward the more permissive quarter.
  const branches: { to: number; likerts: Likert[] }[] = [];
  if (!node.isLeaf) {
    for (const k of LIKERTS) {
      const to = childFor(node.index, k);
      const existing = branches.find((b) => b.to === to);
      if (existing) existing.likerts.push(k);
      else branches.push({ to, likerts: [k] });
    }
    branches.sort((a, b) => a.to - b.to);
  }

  const go = (to: number, via: Likert) => setPath((p) => [...p, { index: to, via }]);
  const back = () => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));
  const jump = (depth: number) => setPath((p) => p.slice(0, depth + 1));

  return (
    <div className="rounded-xl border border-border bg-bg/40 p-5 md:p-7">
      {/* Trail back to the root */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]" aria-label="Question path">
          {path.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 ? <span className="text-faint">/</span> : null}
              <button
                type="button"
                onClick={() => jump(i)}
                disabled={i === path.length - 1}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono transition-colors",
                  i === path.length - 1
                    ? "text-accent"
                    : "text-muted hover:bg-raised hover:text-fg",
                )}
              >
                {crumb.via ? LIKERT_LABEL[crumb.via] : "Start"}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-wider text-faint"
            title="Answers in this tree whose weight equation has every input set"
          >
            {ready.toLocaleString()} / {total.toLocaleString()} ready
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Layer {node.depth} of {TREE_DEPTH}
            {node.isLeaf ? " · scored" : ""}
          </span>
          {path.length > 1 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <ChevronLeft className="size-3.5" />
              Back
            </button>
          ) : null}
        </div>
      </div>

      {/* The question itself — click straight into it to reword it */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={`q-${node.id}`}
            className="font-mono text-[10px] uppercase tracking-wider text-muted"
          >
            Question
          </label>
          {edited ? (
            <button
              type="button"
              onClick={() => {
                onQuestionChange(node.id, "");
                setResetTick((t) => t + 1);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-warn transition-opacity hover:opacity-80"
            >
              <RotateCcw className="size-3" />
              Reset wording
            </button>
          ) : null}
        </div>
        <QuestionEditor
          key={`${node.id}:${resetTick}`}
          id={`q-${node.id}`}
          initial={text}
          edited={edited}
          onChange={(v) => onQuestionChange(node.id, v)}
        />
      </div>

      {/* Connector */}
      <div className="mx-auto my-5 h-6 w-px bg-border" aria-hidden />

      {node.isLeaf ? (
        <AnswerEquations
          key={node.id}
          node={node}
          categoryId={categoryId}
          mode={mode}
          equations={equations[node.id]}
          onChange={onEquationChange}
          onClear={onEquationClear}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {branches.map((branch, bi) => (
            <div key={branch.to} className="flex flex-col gap-1.5">
              {branch.likerts.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => go(branch.to, k)}
                  className={cn(
                    "flex h-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors",
                    BRANCH_TONE,
                  )}
                >
                  <span className="text-xs font-medium text-fg">{LIKERT_LABEL[k]}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The question text box.
 *
 * Holds its own draft rather than reading straight from the store on every
 * keystroke. Clearing the field stores no override — which resolves back to the
 * generated wording — so a store-driven value would refill the box the instant you
 * emptied it and make retyping a question impossible. Mounted with the node id as
 * `key`, so navigating to another question re-seeds the draft.
 */
function QuestionEditor({
  id,
  initial,
  edited,
  onChange,
}: {
  id: string;
  initial: string;
  edited: boolean;
  onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <textarea
      id={id}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value);
      }}
      rows={Math.max(2, Math.ceil(draft.length / 64))}
      className={cn(
        "mt-2 w-full resize-y rounded-lg border bg-surface/60 px-4 py-3 text-base leading-relaxed text-fg outline-none transition-colors",
        "hover:border-border focus:border-accent/60 focus:ring-2 focus:ring-accent/20",
        edited ? "border-warn/50" : "border-border/50",
      )}
      spellCheck
    />
  );
}

function fmtWeight(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}

/**
 * The four answers at a scored question. Each answer's weight is defined by its own
 * equation; pick an answer to open that equation.
 *
 * The equation is never evaluated here: SC comes from the population, which only exists
 * once a run starts. What this can say is whether every authored input is present —
 * red until then, green once the equation is ready for a run.
 */
function AnswerEquations({
  node,
  categoryId,
  mode,
  equations,
  onChange,
  onClear,
}: {
  node: TreeNode;
  categoryId: string;
  mode: Mode;
  equations: LeafEquations | undefined;
  onChange: (leafId: string, likert: Likert, patch: Partial<WeightEquation>) => void;
  onClear: (leafId: string, likert: Likert) => void;
}) {
  const [selected, setSelected] = useState<Likert | null>(null);
  const where = { categoryId, mode, nodeIndex: node.index };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted">
        End of this tree — each answer’s weight comes from its own equation. Pick an
        answer to set it.
      </p>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {LIKERTS.map((k) => {
          const missing = missingInputs(equations?.[k]);
          const done = missing.length === 0;
          const isOpen = selected === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={isOpen}
              onClick={() => setSelected(isOpen ? null : k)}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border px-3 py-3 text-left transition-colors",
                isOpen ? "border-accent bg-accent/15" : "border-border bg-surface/60 hover:bg-raised",
              )}
            >
              <span className="text-xs font-medium text-fg">{LIKERT_LABEL[k]}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px]",
                  done ? "text-pos" : "text-neg",
                )}
              >
                <span
                  className={cn("size-2 rounded-full", done ? "bg-pos" : "bg-neg")}
                  aria-hidden
                />
                {done ? "Ready" : `${5 - missing.length} of 5 set`}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <EquationPanel
          key={selected}
          leafId={node.id}
          likert={selected}
          equation={equations?.[selected]}
          placeholder={placeholderWeight(where, selected)}
          onChange={onChange}
          onClear={onClear}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

const FIELD =
  "h-10 rounded-md border bg-raised px-2 font-mono text-sm text-fg outline-none ring-accent/40 placeholder:text-faint focus:ring-2";

function EquationPanel({
  leafId,
  likert,
  equation,
  placeholder,
  onChange,
  onClear,
  onClose,
}: {
  leafId: string;
  likert: Likert;
  equation: WeightEquation | undefined;
  placeholder: number;
  onChange: (leafId: string, likert: Likert, patch: Partial<WeightEquation>) => void;
  onClear: (leafId: string, likert: Likert) => void;
  onClose: () => void;
}) {
  // Bumped by "Clear" so the number fields drop their local drafts.
  const [clearTick, setClearTick] = useState(0);
  const missing = missingInputs(equation);
  const done = missing.length === 0;
  const set = (patch: Partial<WeightEquation>) => onChange(leafId, likert, patch);
  const tier = PROXIMITY_TIERS.find((t) => t.value === equation?.px);
  const hasAny = !!equation && Object.keys(equation).length > 0;

  return (
    <div
      role="group"
      aria-label={`Weight equation for ${LIKERT_LABEL[likert]}`}
      className="rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Weight equation
          </p>
          <p className="mt-0.5 text-sm text-fg">Answer: {LIKERT_LABEL[likert]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close equation"
          className="rounded-md p-1 text-muted transition-colors hover:bg-raised hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-3 font-mono text-xs text-muted">
        weight = w<sub>PMC</sub> · (PMC / {PMC_MAX}) + w<sub>PX</sub> · PX + w<sub>SC</sub> · SC
      </p>

      <div key={clearTick} className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-3 font-mono text-sm">
        <NumField
          label="w_PMC"
          value={equation?.wPmc}
          missing={missing.includes("w_PMC")}
          onCommit={(v) => set({ wPmc: v })}
        />
        <Op>· (</Op>
        <NumField
          label={`PMC (0–${PMC_MAX})`}
          value={equation?.pmc}
          min={0}
          max={PMC_MAX}
          missing={missing.includes("PMC")}
          onCommit={(v) => set({ pmc: v == null ? v : Math.max(0, Math.min(PMC_MAX, v)) })}
        />
        <Op>/ {PMC_MAX}) +</Op>
        <NumField
          label="w_PX"
          value={equation?.wPx}
          missing={missing.includes("w_PX")}
          onCommit={(v) => set({ wPx: v })}
        />
        <Op>·</Op>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] text-muted">PX</span>
          <select
            value={equation?.px ?? ""}
            onChange={(e) =>
              set({ px: e.target.value ? (e.target.value as ProximityTier) : undefined })
            }
            className={cn(FIELD, "font-sans", missing.includes("PX") ? "border-neg/60" : "border-border")}
          >
            <option value="">Choose…</option>
            {PROXIMITY_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({t.level.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <Op>+</Op>
        <NumField
          label="w_SC"
          value={equation?.wSc}
          missing={missing.includes("w_SC")}
          onCommit={(v) => set({ wSc: v })}
        />
        <Op>·</Op>
        <span className="flex flex-col gap-1">
          <span className="font-sans text-[11px] text-muted">SC</span>
          <span className="flex h-10 items-center rounded-md border border-dashed border-border px-2 text-xs text-faint">
            measured per run
          </span>
        </span>
      </div>

      <div className="mt-3 grid gap-1 font-sans text-[11px] leading-snug text-faint">
        <span>
          Coefficients are in score points and may be negative: a term’s coefficient is the
          most it can add, and its sign sets the direction (positive = Biblical).
        </span>
        <span>
          PMC: how bad, how likely and how soon the harm is, as one rating.{" "}
          {tier ? `PX: ${tier.hint}` : "PX: how close the people affected are; if only the actor is affected, set w_PX to 0."}
        </span>
      </div>

      <div
        role="status"
        className={cn(
          "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
          done ? "border-pos/50 bg-pos/10 text-pos" : "border-neg/50 bg-neg/10 text-neg",
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", done ? "bg-pos" : "bg-neg")} aria-hidden />
          {done
            ? "All inputs set — the weight is computed when a run starts, once SC is measured."
            : `Missing ${missing.join(", ")}. Until then, runs use the placeholder weight ${fmtWeight(placeholder)}.`}
        </span>
        {hasAny ? (
          <button
            type="button"
            onClick={() => {
              onClear(leafId, likert);
              setClearTick((t) => t + 1);
            }}
            className="text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <span className="pb-2.5 text-muted">{children}</span>;
}

/**
 * A number box that keeps its own draft, so typing "-" or clearing the field on the way
 * to a value does not get rejected mid-keystroke. An empty or unparseable draft commits
 * as unset.
 */
function NumField({
  label,
  value,
  min,
  max,
  missing,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  missing: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-[11px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        placeholder="—"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const raw = e.target.value.trim();
          const n = Number(raw);
          onCommit(raw === "" || !Number.isFinite(n) ? undefined : n);
        }}
        className={cn(FIELD, "w-24", missing ? "border-neg/60" : "border-border")}
      />
    </label>
  );
}
