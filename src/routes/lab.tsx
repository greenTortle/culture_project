import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Results } from "@/components/results";
import { InfoTip } from "@/components/info-tip";
import { Button, Input, Panel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLine } from "@/lib/culture/store";
import {
  MIX_OPTIONS,
  clampParam,
  paramGroups,
  type NumericParamDef,
} from "@/lib/culture/params";
import type { SimParams } from "@/lib/culture/types";

export const Route = createFileRoute("/lab")({ component: LabPage });

function LabPage() {
  const params = useLine((s) => s.params);
  const setParams = useLine((s) => s.setParams);
  const run = useLine((s) => s.run);
  const running = useLine((s) => s.running);
  const snapshot = useLine((s) => s.snapshot);
  const user = useLine((s) => s.user);

  // Settings fold away once a run exists so the results are what you land on.
  // They stay open until you actually run something.
  const [showParams, setShowParams] = useState(true);

  const mix = MIX_OPTIONS.find((m) => m.value === params.mix) ?? MIX_OPTIONS[1]!;
  const groups = paramGroups();

  const handleRun = () => {
    run();
    setShowParams(false);
  };

  return (
    <main className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-3xl">Lab</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Generate a student body, optionally drop your poll profile in, and let
          them interact over a season.
        </p>
      </header>

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Run configuration</h2>
            <p className="mt-1 text-sm text-muted">
              {user
                ? `${user.name} is seeded into the population.`
                : "No poll on file — fully synthetic."}{" "}
              <Link to="/poll" className="text-accent underline-offset-2 hover:underline">
                Poll
              </Link>
              {" · "}
              <Link to="/weights" className="text-accent underline-offset-2 hover:underline">
                Weights
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowParams((v) => !v)}
              aria-expanded={showParams}
            >
              <ChevronDown
                className={cn(
                  "mr-1.5 size-4 transition-transform duration-150",
                  showParams && "rotate-180",
                )}
              />
              {showParams ? "Hide settings" : "Settings"}
            </Button>
            <Button onClick={handleRun} disabled={running}>
              {running ? "Running…" : snapshot ? "Run again" : "Run simulation"}
            </Button>
          </div>
        </div>

        {showParams ? (
          <div className="mt-6 flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.title}>
                <div className="border-b border-border pb-2">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {group.title}
                  </h3>
                  {group.hint ? (
                    <p className="mt-1 text-xs text-muted">{group.hint}</p>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-x-6 gap-y-7 lg:grid-cols-2">
                  {group.params.map((def) => (
                    <Param
                      key={def.key}
                      def={def}
                      params={params}
                      onChange={(v) => setParams({ [def.key]: v } as Partial<SimParams>)}
                    />
                  ))}

                  {group.title === "Population & time" ? (
                    <div className="flex flex-col gap-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                          Population mix
                          <InfoTip text="How the synthetic community is drawn. Each person gets a hidden leaning that colours every poll answer they give, which in turn sets where they start. This picks how those leanings are spread across the group." />
                        </span>
                        <span className="font-mono text-[11px] text-faint">
                          {MIX_OPTIONS.length} options
                        </span>
                      </span>
                      <select
                        className="h-11 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg outline-none ring-accent/40 focus:ring-2"
                        value={params.mix}
                        aria-label="Population mix"
                        onChange={(e) =>
                          setParams({ mix: e.target.value as SimParams["mix"] })
                        }
                      >
                        {MIX_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-relaxed text-muted">
                        {mix.describe}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted">
            {snapshot
              ? `Settings hidden — ${snapshot.names.length} people over ${snapshot.params.steps} steps.`
              : "Settings hidden."}
          </p>
        )}
      </Panel>

      {snapshot ? (
        <Results snap={snapshot} />
      ) : (
        <p className="text-sm text-muted">
          Run the model to see trajectories, the social graph, and extremes.
        </p>
      )}

      <Panel>
        <h2 className="font-display text-lg">About the model</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          What happens on each step, why each rule has the shape it does, and which
          published work each one is taken from.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <section>
            <h3 className="font-display text-sm">How the model runs</h3>
            <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>
                Each person answers five questions per category per mode. Every answer
                leads to a different follow-up, narrowing the spectrum to a quarter each
                time, so five questions place them at 1 of 256 positions. The
                individualistic answer sets their starting score on a −12 to +12 scale,
                which is also kept as that person’s permanent anchor.
              </li>
              <li>
                Before anyone meets, the model measures <em>social consensus</em> — how
                closely the whole population agrees on where the line sits in each
                category — once, from those starting answers.
              </li>
              <li>
                Every answer is then scored from its <em>weight equation</em>, set on the
                Weights page: its three coefficients, its PMC and PX ratings, and the
                social consensus just measured. Answers whose equation is not complete yet
                use a placeholder weight.
              </li>
              <li>
                People carry private traits: how fast they settle, how much they stick to
                familiar company, how much sway they hold over others, how stubborn they
                are, and how sociable. Synthetic people draw these at random; yours are
                fixed if you took the poll. Stubbornness is then nudged by how swayable
                each person’s own answers show them to be, compared with everyone else in
                the run.
              </li>
              <li>
                Each step, everyone starts a random number of meetings, on average the
                Extroversion setting times their own sociability.
              </li>
              <li>
                A meeting holds two people, and each further person joins with the
                probability set by Group size — so pairs are most common, trios rarer,
                and larger groups rarer still. Members are drawn with a bias toward people
                the starter already knows. The topic tends to be whatever the starter and
                their first partner discussed last time.
              </li>
              <li>
                In that category, everyone in the meeting updates at once. Each person
                moves toward the average of the members they take seriously — how far
                depends on how far apart they are, how stubborn they are, how much sway
                the others hold, and how open they still are this late in the season —
                then is pulled slightly back toward their own starting view.
              </li>
              <li>
                Ties between everyone in the meeting strengthen, a pair most of all, a
                large group a little each. Nobody drops out during the run.
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-display text-sm">Why the rule looks like that</h3>
            <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted">
              Strip the modifiers away and each conversation is just a weighted average
              of views — the DeGroot model. That has exactly one long-run outcome on a
              connected group: everyone converges. Measured over 25 runs, plain averaging
              destroyed about a third of the variation no matter how the community
              started — two opposed camps dissolved at the same rate as a moderate group.
              The terms below exist to give the model endings other than “everyone ends
              up in the same place”.
            </p>
            <dl className="mt-3 flex flex-col gap-2.5 text-xs leading-relaxed text-muted">
              <div>
                <dt className="text-fg">Tuning people out (Polarization 1)</dt>
                <dd className="mt-0.5">
                  People discount views far from their own, so influence fades with
                  distance. This is <em>bounded confidence</em> (Deffuant et al.;
                  Hegselmann &amp; Krause), with one change: instead of a hard cut-off
                  where influence drops from full to nothing, it falls away smoothly, so a
                  slightly-too-far person still counts for something. This is the change
                  that lets the starting mix matter.
                </dd>
              </div>
              <div>
                <dt className="text-fg">Pushback (Polarization 2)</dt>
                <dd className="mt-0.5">
                  Past a certain distance, meeting someone pushes you away rather than
                  pulling you in. This is Sherif’s <em>Social Judgment Theory</em>: a
                  latitude of acceptance near your own view (you assimilate), a zone of
                  non-commitment, and a latitude of rejection where a message produces a
                  contrast or “boomerang” effect. The influence curve has all three —
                  positive near the centre, crossing zero, then negative — so no separate
                  mechanism is needed. It differs from the textbook version in one way:
                  the push fades again at extreme distance, so people bristle at a view
                  that is recognisably wrong, not at one so foreign it does not register.
                  Kept small on purpose; people who already agree are unaffected at any
                  setting.
                </dd>
              </div>
              <div>
                <dt className="text-fg">The pull back to your own view</dt>
                <dd className="mt-0.5">
                  This is the Friedkin–Johnsen model of social influence: each person is
                  partly open to the people around them and partly attached, permanently,
                  to where they started, so the resting point blends the two instead of
                  racing to the mean. It is written as a small step each meeting rather
                  than Friedkin and Johnsen’s one-line blend, which is the same model
                  taken a meeting at a time. Openness and attachment share the Stubbornness
                  control, because resisting persuasion and holding on to where you began
                  are one disposition — as separate controls they could be set to
                  describe someone wide open to persuasion yet immovably anchored.
                </dd>
              </div>
              <div>
                <dt className="text-fg">Groups, not just pairs</dt>
                <dd className="mt-0.5">
                  Meeting size follows a geometric distribution: size 2, then each extra
                  member with probability <em>q</em> (the Group size control), so
                  P(size) = (1 − q)·q<sup>size − 2</sup> and a meeting of the whole
                  community is practically impossible. Inside a meeting, each person
                  moves toward the Hegselmann–Krause local average — the average of the
                  members they register, weighted by the same influence curve, and divided
                  by how many were actually heard, so someone tuned out does not dilute
                  the others. For two people this reduces exactly to the one-on-one rule;
                  at Group size 0 a run is identical to the pairwise model.
                </dd>
              </div>
              <div>
                <dt className="text-fg">Settling with age, not mileage</dt>
                <dd className="mt-0.5">
                  The old model gave each person a fixed quota of conversations and froze
                  them when it ran out. That put a cliff in the middle of the run, made the
                  Time steps control mostly inert, and had the perverse effect that the{" "}
                  <em>most</em> social people stopped changing <em>first</em>. Openness now
                  fades smoothly with elapsed time instead.
                </dd>
              </div>
              <div>
                <dt className="text-fg">Swayability, measured rather than assumed</dt>
                <dd className="mt-0.5">
                  The poll asks both “I would do X” and “I would do X if a friend were”,
                  and the distance between those two answers is how far that person moves
                  toward company in that category (α). Its direction is informative too,
                  and sets a small bias for whether company pulls that person up or down.
                </dd>
              </div>
              <div>
                <dt className="text-fg">Stubbornness, nudged by swayability</dt>
                <dd className="mt-0.5">
                  Stubbornness is still a random draw, since the poll does not ask about
                  personality, but it is no longer only random. Each person’s α is
                  averaged across categories and compared with the median of the
                  population: stubbornness = base − 1 × (mean α − median α), kept within
                  0.05–0.9. Someone whose answers swing when a friend is involved is
                  showing low general resistance, so they become less stubborn; someone
                  whose answers never move becomes more so. The strength was calibrated so
                  a typical person moves about ±0.06 and one at the 90th percentile about
                  ±0.15 — the same size as the existing piety nudge, so neither dominates.
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="font-display text-sm">Weights: where an answer’s score comes from</h3>
          <div className="mt-3 grid gap-x-8 gap-y-3 text-xs leading-relaxed text-muted lg:grid-cols-2">
            <p>
              Each of the four answers at a scored ending has its own equation:{" "}
              <span className="font-mono text-fg">
                weight = w<sub>PMC</sub> · (PMC / 10) + w<sub>PX</sub> · PX + w<sub>SC</sub> ·
                SC
              </span>
              . The weight depends on nothing else. The three quantities come from Jones’s{" "}
              <em>moral intensity</em> construct. Jones proposed six characteristics, but
              when McMahon and Harvey factor-analysed them only three held up as distinct:
              magnitude of consequences, probability of effect and temporal immediacy
              collapsed into one factor,{" "}
              <span className="text-fg">Probable Magnitude of Consequences (PMC)</span>;{" "}
              <span className="text-fg">Proximity (PX)</span> and{" "}
              <span className="text-fg">Social Consensus (SC)</span> stayed separate; and
              concentration of effect could not be measured reliably and is left out.
            </p>
            <p>
              <span className="text-fg">PMC</span> is typed in, 0–10, as one rating of how
              bad, how likely and how soon the harm is. <span className="text-fg">PX</span>{" "}
              is picked from four tiers — society at large (0), wider community (⅓),
              friends and acquaintances (⅔), close relationships (1) — since nearer victims
              make an act more intense. <span className="text-fg">SC</span> is never typed
              in: it is 1 − σ/0.5, where σ is the spread of the population’s starting
              positions in that category’s tree — 1 when everyone agrees, 0 when the
              community is split between the two extremes.
            </p>
            <p>
              Every term in parentheses is on 0–1, so each coefficient is the most score
              points its term can add, and its sign sets the direction — positive toward
              Biblical, negative toward sinful. Coefficients are entered per answer, because
              which factors matter, and which way, differs between “strongly agree” and
              “strongly disagree” on the same statement. A sum rather than a product,
              because the factor analysis found the three distinct and nothing supports
              letting one low factor wipe out the others.
            </p>
            <p>
              Because SC belongs to the population, a weight only exists once a run starts;
              the Weights page marks an answer red until all five authored inputs are set
              and green once they are, and never shows a number. Answers still red are
              scored with their generated placeholder weight so a run can go ahead. SC is
              measured per tree rather than per question: an ending is only ever reached by
              people who already share a line, so agreement there is agreement among the
              like-minded, not community-wide consensus. It is measured from positions, not
              scores, because scores are computed from it. The values for the latest run
              are shown with the results.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="font-display text-sm">Known simplifications</h3>
          <ul className="mt-3 grid list-disc gap-x-8 gap-y-2 pl-4 text-xs leading-relaxed text-muted lg:grid-cols-2">
            <li>
              <span className="text-fg">Social consensus is frozen at the start.</span>{" "}
              Consensus stands in for the community’s norms, and those norms genuinely
              change over a run as people influence each other — but SC is measured once,
              from starting answers, and not recalculated as the population moves. A
              justified, continuously updated SC would be an improvement to the model. It
              needs two things settled first: what an updated consensus should act on
              (rescaling people’s scores, changing how much a conversation moves someone in
              that category, or only being reported), and at what grain, since during a run
              the model tracks one score per person per category rather than an answer per
              question, so a live SC could only work per category unless per-question
              state is carried through the whole run.
            </li>
            <li>
              <span className="text-fg">Most weights are still placeholders.</span> Until an
              answer’s equation is complete it is scored with a generated filler weight
              that has nothing to do with moral intensity, so a run mixes the two. The
              coefficients themselves are also hand-entered; the defensible way to set them
              is empirically — for example a conjoint study like Tsalikis, Seaton and
              Shepherd’s, which recovered the relative importance of the intensity
              dimensions from people’s choices.
            </li>
            <li>
              <span className="text-fg">Categories are independent.</span> A conversation
              touches one category and leaves the others untouched, so alcohol and
              relationships evolve separately even though they are plainly related in
              real people. The fix is a spillover matrix, so a shift in one category
              produces a fractional shift in related ones, plus drawing each person’s
              starting views as a correlated set rather than from a single hidden leaning.
              Deliberately deferred — worth doing once those correlations can be estimated
              from real poll data rather than guessed.
            </li>
            <li>
              <span className="text-fg">Groups form around one person.</span> Everyone
              else in a meeting is drawn by their tie to whoever started it, not by their
              ties to each other, and the topic is set by the starter and their first
              partner. Real groups form out of mutual friendships; drawing members by
              their combined ties to everyone already present would be closer.
            </li>
            <li>
              <span className="text-fg">Nothing generates variation.</span> Every term here
              either pulls people together or holds them still; there is no shock, private
              experience, teaching, or media. Adding a small random nudge each step, or an
              institutional pull toward the college’s stated values, would stop
              homogenization from being the only mechanism in the model.
            </li>
            <li>
              <span className="text-fg">One run is one sample.</span> A single seed cannot
              tell a real category shift apart from noise. Every conclusion should really
              be an average over many runs with an error range; a run is only a few
              thousand conversations, so a hundred of them costs very little.
            </li>
            <li>
              <span className="text-fg">Sway and stubbornness are only partly separable.</span>{" "}
              Stubbornness is now partly derived from measured swayability, but it keeps a
              random base, and both it and sway are multipliers with hand-picked constants,
              so a small movement still cannot be cleanly attributed to one rather than the
              other. Measuring them separately in the poll would resolve it.
            </li>
          </ul>
        </div>

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="font-display text-sm">Where the rules come from</h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
            <li>
              Deffuant, G., Neau, D., Amblard, F., &amp; Weisbuch, G. (2000). Mixing
              beliefs among interacting agents. <em>Advances in Complex Systems</em>, 3.
              — bounded confidence (Polarization 1).
            </li>
            <li>
              Hegselmann, R., &amp; Krause, U. (2002). Opinion dynamics and bounded
              confidence: models, analysis and simulation.{" "}
              <em>Journal of Artificial Societies and Social Simulation</em>, 5(3). —
              bounded confidence; the group local average.
            </li>
            <li>
              Sherif, M., &amp; Hovland, C. I. (1961). <em>Social Judgment</em>. Yale
              University Press. — latitudes of acceptance and rejection (Polarization 2).
            </li>
            <li>
              Friedkin, N. E., &amp; Johnsen, E. C. (2011).{" "}
              <em>Social Influence Network Theory</em>. Cambridge University Press. —
              susceptibility and attachment to one’s starting view.
            </li>
            <li>
              Jones, T. M. (1991). Ethical decision making by individuals in
              organizations: an issue-contingent model.{" "}
              <em>Academy of Management Review</em>, 16(2). — moral intensity.
            </li>
            <li>
              McMahon, J. M., &amp; Harvey, R. J. (2006). An analysis of the factor
              structure of Jones’ moral intensity construct.{" "}
              <em>Journal of Business Ethics</em>, 64(4), 381–404. — the three factors in
              the weight equation.
            </li>
            <li>
              Tsalikis, J., Seaton, B., &amp; Shepherd, P. (2008). Relative importance
              measurement of the moral intensity dimensions.{" "}
              <em>Journal of Business Ethics</em>, 80(3), 613–626. — estimating the
              coefficients empirically.
            </li>
          </ul>
        </div>
      </Panel>
    </main>
  );
}

function decimals(step: number) {
  const s = String(step);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

function Param({
  def,
  params,
  onChange,
}: {
  def: NumericParamDef;
  params: SimParams;
  onChange: (n: number) => void;
}) {
  const value = params[def.key];
  const d = decimals(def.step);
  const commit = (raw: number) => onChange(clampParam(def, raw));
  const plainNumber = def.inputType === "number";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium leading-snug text-fg">
          {def.label}
          <InfoTip text={def.info} />
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
          {def.min}–{def.max}
          {def.unit ? ` ${def.unit}` : ""}
        </span>
      </div>

      {plainNumber ? (
        /* A seed is a label, not a magnitude — a slider invites dragging it as if
           7 and 8 were near neighbours in outcome, which they are not. */
        <Input
          type="number"
          className="w-32 font-mono tabular-nums"
          min={def.min}
          max={def.max}
          step={def.step}
          value={Number(value.toFixed(d))}
          aria-label={def.label}
          onChange={(e) => commit(Number(e.target.value))}
          onBlur={(e) => commit(Number(e.target.value))}
        />
      ) : (
        <div className="flex items-start gap-3">
          {/* slider and its scale share a column so the anchors line up with the track */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              type="range"
              className="h-11 w-full accent-[var(--color-accent)]"
              min={def.min}
              max={def.max}
              step={def.step}
              value={value}
              aria-label={def.label}
              onChange={(e) => commit(Number(e.target.value))}
            />
            <div className="flex justify-between gap-2 font-mono text-[10px] leading-tight text-faint">
              {def.anchors.map((a, i) => (
                <span
                  key={a.at}
                  className={
                    i === 0
                      ? "text-left"
                      : i === def.anchors.length - 1
                        ? "text-right"
                        : "text-center"
                  }
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
          <Input
            type="number"
            className="w-24 shrink-0 text-right font-mono tabular-nums"
            min={def.min}
            max={def.max}
            step={def.step}
            value={Number(value.toFixed(d))}
            aria-label={`${def.label} value`}
            onChange={(e) => commit(Number(e.target.value))}
            onBlur={(e) => commit(Number(e.target.value))}
          />
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted">{def.describe(params)}</p>
    </div>
  );
}
