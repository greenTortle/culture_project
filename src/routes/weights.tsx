import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui";
import { VisualTree } from "@/components/visual-tree";
import { CATEGORIES, LEAF_COUNT, TREE_DEPTH, TREE_SIZE, treeFor } from "@/lib/culture/catalog";
import { completedAnswers } from "@/lib/culture/severity";
import { LIKERTS } from "@/lib/culture/types";
import { useLine } from "@/lib/culture/store";

export const Route = createFileRoute("/weights")({ component: WeightsPage });

function WeightsPage() {
  const questions = useLine((s) => s.questions);
  const equations = useLine((s) => s.equations);
  const setQuestionText = useLine((s) => s.setQuestionText);
  const resetQuestions = useLine((s) => s.resetQuestions);
  const setAnswerEquation = useLine((s) => s.setAnswerEquation);
  const clearAnswerEquation = useLine((s) => s.clearAnswerEquation);
  const resetEquations = useLine((s) => s.resetEquations);

  const editedCount = Object.keys(questions).length;
  const answersWithInputs = Object.values(equations).reduce(
    (n, leaf) => n + Object.keys(leaf).length,
    0,
  );
  const allLeafIds = CATEGORIES.flatMap((cat) =>
    (["individualistic", "communal"] as const).flatMap((mode) =>
      treeFor(cat.id, mode)
        .filter((n) => n.isLeaf)
        .map((n) => n.id),
    ),
  );
  const ready = completedAnswers(equations, allLeafIds);
  const total = allLeafIds.length * LIKERTS.length;

  return (
    <main className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-warn">Filler inputs</p>
        <h1 className="mt-2 font-display text-3xl">Decision trees</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Each category has two trees of {TREE_SIZE} questions, {TREE_DEPTH + 1} questions
          deep, ending in {LEAF_COUNT} scored endings. Every answer leads to a different
          follow-up: agreeing with a statement means your line is at least that
          permissive, so it narrows toward the more permissive end of the spectrum;
          disagreeing narrows toward the stricter end — and the strength of the answer
          decides how far it moves. Follow a path by answering, and edit any question’s
          wording in place — changes show up in the poll straight away.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          At a scored ending, each of the four answers gets its own weight equation:{" "}
          <span className="font-mono text-xs text-fg">
            weight = w_PMC · (PMC / 10) + w_PX · PX + w_SC · SC
          </span>
          . Pick an answer, then enter its three coefficients, its PMC (how bad, likely
          and immediate the consequences are) and its PX (how close the people affected
          are). SC — how much the community agrees — is measured from the population when
          a run starts, so no weight is shown here: an answer turns green once everything
          else is set. Answers still red use their placeholder weight in runs.
        </p>
        <p className="mt-3 font-mono text-xs text-muted">
          {ready.toLocaleString()} of {total.toLocaleString()} answers ready
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={resetQuestions} disabled={editedCount === 0}>
            {editedCount === 0
              ? "No edited questions"
              : `Reset ${editedCount} edited question${editedCount === 1 ? "" : "s"}`}
          </Button>
          <Button variant="outline" onClick={resetEquations} disabled={answersWithInputs === 0}>
            {answersWithInputs === 0
              ? "No weight equations"
              : `Clear ${answersWithInputs} weight equation${answersWithInputs === 1 ? "" : "s"}`}
          </Button>
        </div>
      </header>

      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl">{cat.name}</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {(["individualistic", "communal"] as const).map((mode) => (
              <div key={mode}>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                  {mode}
                </p>
                <VisualTree
                  categoryId={cat.id}
                  mode={mode}
                  questions={questions}
                  equations={equations}
                  onQuestionChange={setQuestionText}
                  onEquationChange={setAnswerEquation}
                  onEquationClear={clearAnswerEquation}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
