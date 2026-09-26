import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORIES } from "@/lib/culture/catalog";
import { extremes, populationMeans, topChangers } from "@/lib/culture/stats";
import { treeKey } from "@/lib/culture/severity";
import type { SimSnapshot } from "@/lib/culture/types";
import { NetworkGraph } from "./network-graph";
import { Panel } from "./ui";

/** Text tokens, mirrored from styles.css for the canvas-drawn recharts axes. */
const INK_MUTED = "#8f8e86";
const GRID = "#2a2c26";
const SURFACE = "#151613";

/** Smallest "round" number at or above x, for a readable bar axis. */
function niceCeil(x: number) {
  const steps = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12];
  return steps.find((s) => s >= x) ?? Math.ceil(x);
}

/**
 * Y-range for the trajectory chart. Scores live on a −12…12 scale but a run
 * usually moves inside a band a couple of points wide; a fixed −8…8 axis flattens
 * all seven series into one indistinguishable line. Fit the data instead, always
 * keeping 0 in view and never zooming tighter than a 2-point span (so noise-level
 * wobble is not magnified into a trend).
 */
function niceDomain(values: number[]): [number, number] {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  const pad = Math.max(0.25, (hi - lo) * 0.12);
  lo = Math.floor((lo - pad) * 2) / 2;
  hi = Math.ceil((hi + pad) * 2) / 2;
  while (hi - lo < 2) {
    lo -= 0.5;
    hi += 0.5;
  }
  return [Math.max(-12, lo), Math.min(12, hi)];
}

export function Results({ snap }: { snap: SimSnapshot }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const means0 = populationMeans(snap, "v0");
  const means1 = populationMeans(snap, "v");
  const changers = topChangers(snap);
  const ext = extremes(snap);
  const chartData = snap.history.map((h) => {
    const row: Record<string, number> = { t: h.t, overall: Number(h.overall.toFixed(3)) };
    CATEGORIES.forEach((c, i) => {
      row[c.id] = Number(h.means[i]!.toFixed(3));
    });
    return row;
  });

  const deltas = CATEGORIES.map((_, i) => means1[i]! - means0[i]!);
  const shiftScale = niceCeil(Math.max(0.25, ...deltas.map((d) => Math.abs(d))));
  const yDomain = niceDomain(snap.history.flatMap((h) => h.means));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="People" value={String(snap.names.length)} />
        <Stat label="Meetings" value={String(snap.interactions)} />
        <Stat
          label="People per meeting"
          value={snap.meanGroupSize != null ? snap.meanGroupSize.toFixed(2) : "2.00"}
        />
        <Stat
          label="Mean shift"
          value={`${(means1.reduce((a, b) => a + b, 0) / means1.length - means0.reduce((a, b) => a + b, 0) / means0.length).toFixed(2)}`}
        />
      </div>

      <Panel>
        <h2 className="font-display text-lg">Population means over time</h2>
        <p className="mt-1 text-sm text-muted">
          Average score per category across everyone, as the season runs. Higher is
          more Biblical.
        </p>
        <div className="mt-4 h-80 w-full">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke={GRID}
                  tick={{ fill: INK_MUTED, fontSize: 11 }}
                  tickLine={false}
                  label={{
                    value: "time step",
                    position: "insideBottomRight",
                    offset: -2,
                    fill: INK_MUTED,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  stroke={GRID}
                  tick={{ fill: INK_MUTED, fontSize: 11 }}
                  tickLine={false}
                  domain={yDomain}
                  allowDecimals
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: GRID, strokeWidth: 1 }}
                  contentStyle={{
                    background: SURFACE,
                    border: `1px solid ${GRID}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: INK_MUTED }}
                  itemSorter={(item) => -(item.value as number)}
                  formatter={(value: number, name: string) => [value.toFixed(2), name]}
                />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) => (
                    <span style={{ color: INK_MUTED }}>{value}</span>
                  )}
                />
                {CATEGORIES.map((c) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.name}
                    stroke={c.color}
                    dot={false}
                    activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-md bg-raised" />
          )}
        </div>
      </Panel>

      {ready ? <NetworkGraph snap={snap} /> : <div className="h-80 rounded-xl bg-raised" />}

      <Panel>
        <h2 className="font-display text-lg">Category shift</h2>
        <p className="mt-1 text-sm text-muted">
          How far the population mean moved over the season. Bars run from a zero
          line in the middle — <span className="text-shift-down">red left</span> is a
          drop, <span className="text-shift-up">sage right</span> is a rise. Bar
          length is proportional; full scale is ±{shiftScale.toFixed(2)}.
        </p>

        <ul className="mt-5 flex flex-col gap-2.5">
          {CATEGORIES.map((c, i) => {
            const d = deltas[i]!;
            const frac = Math.min(1, Math.abs(d) / shiftScale);
            const up = d >= 0;
            return (
              <li
                key={c.id}
                className="grid items-center gap-3 sm:grid-cols-[minmax(8rem,11rem)_1fr_auto]"
                title={`${c.name}: ${means0[i]!.toFixed(2)} → ${means1[i]!.toFixed(2)} (${up ? "+" : ""}${d.toFixed(2)})`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>

                <div className="relative h-3.5 rounded-full bg-raised">
                  {/* zero line */}
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
                  <div
                    className={
                      up
                        ? "absolute top-0 h-full rounded-r-full bg-shift-up"
                        : "absolute top-0 h-full rounded-l-full bg-shift-down"
                    }
                    style={
                      up
                        ? { left: "50%", width: `${Math.max(2, frac * 50)}%` }
                        : { right: "50%", width: `${Math.max(2, frac * 50)}%` }
                    }
                  />
                </div>

                <span className="text-right font-mono text-xs tabular-nums text-muted">
                  {means0[i]!.toFixed(2)} → {means1[i]!.toFixed(2)}{" "}
                  <span className="text-fg">
                    ({up ? "+" : ""}
                    {d.toFixed(2)})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {/* axis */}
        <div className="mt-2 hidden gap-3 sm:grid sm:grid-cols-[minmax(8rem,11rem)_1fr_auto]">
          <span />
          <div className="flex justify-between font-mono text-[10px] tabular-nums text-faint">
            <span>−{shiftScale.toFixed(2)}</span>
            <span>0</span>
            <span>+{shiftScale.toFixed(2)}</span>
          </div>
          <span className="invisible font-mono text-xs">0.00 → 0.00 (+0.00)</span>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg">Largest individual change</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Ranked by total movement across all categories. Someone can rank high with an
            unchanged average — moving up in one category and down in another still counts
            as moving, so the average is shown alongside rather than instead.
          </p>
          {changers.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {changers.map((r) => (
                <li key={r.i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">
                    {r.name}
                    {r.isUser ? " (you)" : ""}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    <span className="text-fg">{r.mag.toFixed(1)} moved</span>
                    {" · avg "}
                    {r.v0.toFixed(1)} → {r.v.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Nobody moved measurably this run. Try a longer season, more contact, or a
              weaker hold on original views.
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-lg">Extremes (final)</h2>
          <p className="mt-1 text-xs text-muted">Highest / lowest mean scores</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {ext.highest.map((r) => (
              <li key={"h" + r.i} className="flex justify-between">
                <span>{r.name}</span>
                <span className="font-mono tabular-nums text-pos">{r.s.toFixed(2)}</span>
              </li>
            ))}
            {ext.lowest.map((r) => (
              <li key={"l" + r.i} className="flex justify-between">
                <span>{r.name}</span>
                <span className="font-mono tabular-nums text-neg">{r.s.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {snap.consensus ? <ConsensusPanel consensus={snap.consensus} /> : null}
    </div>
  );
}

/**
 * Social consensus as measured for this run. Shown because it is the one input to the
 * weight equations that is never typed in.
 */
function ConsensusPanel({ consensus }: { consensus: Record<string, number> }) {
  const modes = ["individualistic", "communal"] as const;
  return (
    <Panel>
      <h2 className="font-display text-lg">Social consensus (SC)</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        How closely this population agreed on where the line sits in each tree before
        anyone met — 1 is unanimous, 0 is split between the two extremes. Measured once
        at the start of the run and held fixed. This is the SC that every complete weight
        equation in that tree was evaluated with.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-4 font-normal">Category</th>
              {modes.map((m) => (
                <th key={m} className="py-2 pr-4 font-normal">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <tr key={cat.id} className="border-t border-border">
                <td className="py-2 pr-4">
                  <span
                    className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ background: cat.color }}
                    aria-hidden
                  />
                  {cat.name}
                </td>
                {modes.map((m) => {
                  const sc = consensus[treeKey(cat.id, m)];
                  return (
                    <td key={m} className="py-2 pr-4 font-mono tabular-nums">
                      {sc == null
                        ? "—"
                        : sc.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums">{value}</p>
    </div>
  );
}
