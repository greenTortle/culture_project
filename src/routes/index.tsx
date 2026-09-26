import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Panel } from "@/components/ui";
import { CATEGORIES } from "@/lib/culture/catalog";
import { useLine } from "@/lib/culture/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const user = useLine((s) => s.user);
  return (
    <main className="flex flex-col gap-10">
      <section className="max-w-2xl pt-4">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Community culture lab
        </p>
        <h1 className="font-display text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          Find a moral line.
          <br />
          Watch a community move it.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          Line is a prototype of an interactive-community model. A short poll
          locates each person on a spectrum and a backend then lets those people
          meet, clump, and pull on one another over a simulated season — so you
          can see how a culture forms.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/poll">
            <Button>{user ? "Retake the poll" : "Take the poll"}</Button>
          </Link>
          <Link to="/lab">
            <Button variant="outline">Open the lab</Button>
          </Link>
        </div>
        {user ? (
          <p className="mt-4 text-sm text-muted">
            Signed in as {user.name} — you will be placed in the next run.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <h2 className="font-display text-lg">1. Poll</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Questions adapt. Five per category, each answer narrowing the field to
            a quarter, closing in on the statement you feel roughly neutral
            about — your line.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg">2. Weights</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Every numeric score is a highlighted filler. Edit them before a run.
            Relative magnitudes are the scientific argument, not a settled scale.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg">3. Lab</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Synthetic classmates are generated the same way. They interact on a
            weighted graph under bounded confidence, clumping, and decaying
            impressionability.
          </p>
        </Panel>
      </div>

      <section>
        <h2 className="font-display text-xl">Categories</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-surface px-4 py-4">
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
