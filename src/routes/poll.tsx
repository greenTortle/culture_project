import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Field, Input, Panel } from "@/components/ui";
import { CATEGORIES, questionText, treeFor } from "@/lib/culture/catalog";
import { LIKERT_LABEL, LIKERTS } from "@/lib/culture/types";
import { QUESTIONS_PER_TREE, treeOrder } from "@/lib/culture/poll";
import { useLine } from "@/lib/culture/store";
import { isComplete } from "@/lib/culture/severity";

export const Route = createFileRoute("/poll")({ component: PollPage });

function PollPage() {
  const poll = useLine((s) => s.poll);
  const user = useLine((s) => s.user);
  const equations = useLine((s) => s.equations);
  const startPoll = useLine((s) => s.startPoll);
  const answer = useLine((s) => s.answer);
  const clearUser = useLine((s) => s.clearUser);
  const questions = useLine((s) => s.questions);
  const [name, setName] = useState(user?.name ?? "You");

  if (user && !poll) {
    return (
      <main className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl">Your lines</h1>
        <p className="mt-2 text-sm text-muted">
          Final leaves only — the closest statement to neutral in each tree.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {user.leaves.map((leaf) => {
            const cat = CATEGORIES.find((c) => c.id === leaf.categoryId);
            return (
              <li key={leaf.categoryId + leaf.mode} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {cat?.name} · {leaf.mode}
                </p>
                <p className="mt-1 text-sm">{leaf.statementText}</p>
                <p className="mt-2 font-mono text-xs text-accent">
                  {LIKERT_LABEL[leaf.likert]} ·{" "}
                  {isComplete(equations[leaf.statementId]?.[leaf.likert])
                    ? "weight set by equation — computed when a run starts"
                    : `placeholder weight ${leaf.score.toFixed(2)}`}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/lab">
            <Button>Run the lab with me in it</Button>
          </Link>
          <Button variant="outline" onClick={clearUser}>
            Clear and retake
          </Button>
        </div>
      </main>
    );
  }

  if (!poll) {
    return (
      <main className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl">Take the poll</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          50 questions relating to your activity at work, school, hobbies, and more
        </p>
        <Panel className="mt-6">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button className="mt-5 w-full" onClick={() => startPoll(name.trim() || "You")}>
            Begin
          </Button>
        </Panel>
      </main>
    );
  }

  const order = treeOrder();
  const cur = order[poll.treeIdx]!;
  const cat = CATEGORIES.find((c) => c.id === cur.categoryId)!;
  const node = treeFor(cur.categoryId, cur.mode)[poll.walk.nodeIndex]!;
  const askedHere = poll.walk.asked.length;
  const totalTrees = order.length;
  const progress = (poll.treeIdx + askedHere / QUESTIONS_PER_TREE) / totalTrees;

  return (
    <main className="mx-auto max-w-xl">
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {cat.name} · {cur.mode} · question {askedHere + 1} of {QUESTIONS_PER_TREE}
      </p>
      <h1 className="mt-3 font-display text-2xl leading-snug md:text-3xl">
        {questionText(node, questions)}
      </h1>
      <p className="mt-3 text-sm text-muted">{cat.blurb}</p>
      <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LIKERTS.map((k) => (
          <Button
            key={k}
            variant={k === "sa" || k === "a" ? "primary" : "outline"}
            className="h-12"
            onClick={() => answer(k)}
          >
            {LIKERT_LABEL[k]}
          </Button>
        ))}
      </div>
    </main>
  );
}
