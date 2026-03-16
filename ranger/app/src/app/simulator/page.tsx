'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  ArrowRightLeft,
  Percent,
  Shield,
  Zap,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Navbar } from '@/components/layout/Navbar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRangerRates } from '@/hooks/useRangerRates';
import { PROTOCOL_META } from '@/lib/constants';
import type { ProtocolId } from '@/lib/types';

// ---------------------------------------------------------------------------
// Simulation types
// ---------------------------------------------------------------------------

interface SimParams {
  minSpreadBps: number;
  maxAllocationPct: number;
  rebalanceCooldownMin: number;
  idleReservePct: number;
  initialDepositEurc: number;
}

interface SimDataPoint {
  /** Unix timestamp in ms */
  t: number;
  /** Day label for x-axis */
  day: number;
  /** Ranger vault portfolio value */
  rangerValue: number;
  /** Hold EURC baseline (no yield) */
  holdValue: number;
  /** Best single protocol, held the whole time */
  bestSingleValue: number;
  /** Running blended APY at this step (annualized %) */
  blendedApyPct: number;
}

interface SimResult {
  dataPoints: SimDataPoint[];
  totalReturnEurc: number;
  totalReturnPct: number;
  annualizedApyPct: number;
  numRebalances: number;
  maxDrawdownPct: number;
  capitalEfficiencyPct: number;
  alphaVsBestBps: number;
  bestSingleReturnPct: number;
  bestSingleProtocol: ProtocolId;
}

interface SeedRates {
  drift: number;
  kamino: number;
  save: number;
}

// ---------------------------------------------------------------------------
// Simulation engine
// ---------------------------------------------------------------------------

const SIM_DAYS = 30;
const STEP_MINUTES = 15;
const STEPS_PER_DAY = (24 * 60) / STEP_MINUTES; // 96
const TOTAL_STEPS = SIM_DAYS * STEPS_PER_DAY; // 2880
const PROTOCOLS: ProtocolId[] = ['drift', 'kamino', 'save'];

/**
 * Geometric Brownian Motion step for a single rate.
 * drift μ = 0 (rates are mean-reverting in reality but GBM gives realistic jitter)
 * σ = 2% per day → σ_step = σ / sqrt(steps_per_day)
 */
function gbmStep(rate: number, rng: () => number): number {
  const sigma = 0.02 / Math.sqrt(STEPS_PER_DAY);
  // Box-Muller transform from two uniform samples
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // Apply GBM with mild mean-reversion (pull toward 0.97 × current)
  const next = rate * Math.exp(sigma * z) * 0.9999 + rate * 0.0001;
  // Clamp to realistic EURC lending range: 2% – 25%
  return Math.max(200, Math.min(2500, next));
}

/**
 * Mulberry32 — fast, seedable PRNG. Produces reproducible results for the
 * same set of seed rates so the chart is stable across slider moves that
 * don't change rates.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeSeed(rates: SeedRates): number {
  return (
    Math.round(rates.drift) * 1_000_000 +
    Math.round(rates.kamino) * 1_000 +
    Math.round(rates.save)
  );
}

function runSimulation(params: SimParams, seedRates: SeedRates): SimResult {
  const rng = mulberry32(computeSeed(seedRates));

  // Working state
  const currentRatesBps: Record<ProtocolId, number> = {
    drift: seedRates.drift,
    kamino: seedRates.kamino,
    save: seedRates.save,
  };

  // Initial allocation: weight by rate proportionally, respect maxAllocation
  const buildInitialAllocation = (): Record<ProtocolId, number> => {
    const deployable = 1 - params.idleReservePct / 100;
    const maxFrac = params.maxAllocationPct / 100;
    const total = PROTOCOLS.reduce((s, p) => s + currentRatesBps[p], 0);
    const raw: Record<string, number> = {};
    PROTOCOLS.forEach((p) => {
      raw[p] = Math.min((currentRatesBps[p] / total) * deployable, maxFrac);
    });
    // Normalize to exactly deployable
    const rawSum = Object.values(raw).reduce((a, b) => a + b, 0);
    PROTOCOLS.forEach((p) => { raw[p] = (raw[p] / rawSum) * deployable; });
    return raw as Record<ProtocolId, number>;
  };

  const allocation = buildInitialAllocation();
  const deployable = () => PROTOCOLS.reduce((s, p) => s + allocation[p], 0);

  // Ranger vault value — starts at deposit
  let rangerValue = params.initialDepositEurc;
  let peakValue = rangerValue;
  let maxDrawdown = 0;

  // Best single protocol tracking (determined by highest initial rate)
  const bestProto = PROTOCOLS.reduce((best, p) =>
    currentRatesBps[p] > currentRatesBps[best] ? p : best,
  ) as ProtocolId;
  let bestSingleValue = params.initialDepositEurc;

  // Hold EURC baseline (0% yield, just the deposit)
  const holdValue = params.initialDepositEurc;

  // Cooldown tracking
  let stepsSincLastRebalance = (params.rebalanceCooldownMin / STEP_MINUTES) + 1;
  const cooldownSteps = params.rebalanceCooldownMin / STEP_MINUTES;

  let numRebalances = 0;
  let deployedSteps = 0; // steps where capital efficiency > 0

  // Down-sample output: emit 1 point per 4 steps (1 per hour) for 720 chart points
  const EMIT_EVERY = 4;
  const dataPoints: SimDataPoint[] = [];

  // Initial point
  dataPoints.push({
    t: 0,
    day: 0,
    rangerValue,
    holdValue,
    bestSingleValue,
    blendedApyPct: computeBlendedApy(currentRatesBps, allocation),
  });

  for (let step = 1; step <= TOTAL_STEPS; step++) {
    // 1. Evolve rates with GBM
    PROTOCOLS.forEach((p) => {
      currentRatesBps[p] = gbmStep(currentRatesBps[p], rng);
    });

    // 2. Compute current spread
    const sortedRates = PROTOCOLS.map((p) => currentRatesBps[p]).sort((a, b) => b - a);
    const spreadBps = sortedRates[0] - sortedRates[sortedRates.length - 1];

    // 3. Check rebalance trigger
    stepsSincLastRebalance++;
    const shouldRebalance =
      spreadBps >= params.minSpreadBps &&
      stepsSincLastRebalance >= cooldownSteps;

    if (shouldRebalance) {
      // Rebuild allocation toward best-rate protocol
      rebalance(allocation, currentRatesBps, params.maxAllocationPct / 100, params.idleReservePct / 100);
      stepsSincLastRebalance = 0;
      numRebalances++;
    }

    // 4. Compound yield every step (15-min compound period)
    const blendedApy = computeBlendedApy(currentRatesBps, allocation);
    // APY → per-step multiplier  (continuous compounding: e^(r * dt))
    const dt = STEP_MINUTES / (365 * 24 * 60); // fraction of year
    const stepMultiplier = Math.exp((blendedApy / 100) * dt);
    rangerValue *= stepMultiplier;

    // 4b. Best single protocol also compounds
    const bestApy = currentRatesBps[bestProto] / 100;
    const bestMultiplier = Math.exp((bestApy / 100) * dt);
    bestSingleValue *= bestMultiplier;

    // 5. Track drawdown
    if (rangerValue > peakValue) peakValue = rangerValue;
    const drawdownPct = ((peakValue - rangerValue) / peakValue) * 100;
    if (drawdownPct > maxDrawdown) maxDrawdown = drawdownPct;

    // 6. Track capital efficiency (anything deployed earns yield)
    if (deployable() > 0.01) deployedSteps++;

    // 7. Emit data point
    if (step % EMIT_EVERY === 0) {
      const dayFrac = step / STEPS_PER_DAY;
      dataPoints.push({
        t: step,
        day: parseFloat(dayFrac.toFixed(2)),
        rangerValue: parseFloat(rangerValue.toFixed(4)),
        holdValue,
        bestSingleValue: parseFloat(bestSingleValue.toFixed(4)),
        blendedApyPct: parseFloat(blendedApy.toFixed(3)),
      });
    }
  }

  const totalReturnEurc = rangerValue - params.initialDepositEurc;
  const totalReturnPct = (totalReturnEurc / params.initialDepositEurc) * 100;
  // Annualize the 30-day return: (1 + r)^(365/30) - 1
  const annualizedApyPct = (Math.pow(1 + totalReturnPct / 100, 365 / SIM_DAYS) - 1) * 100;

  const bestSingleReturnPct =
    ((bestSingleValue - params.initialDepositEurc) / params.initialDepositEurc) * 100;
  const bestSingleApyPct = (Math.pow(1 + bestSingleReturnPct / 100, 365 / SIM_DAYS) - 1) * 100;
  const alphaVsBestBps = Math.round((annualizedApyPct - bestSingleApyPct) * 100);

  const capitalEfficiencyPct = (deployedSteps / TOTAL_STEPS) * 100;

  return {
    dataPoints,
    totalReturnEurc,
    totalReturnPct,
    annualizedApyPct,
    numRebalances,
    maxDrawdownPct: maxDrawdown,
    capitalEfficiencyPct,
    alphaVsBestBps,
    bestSingleReturnPct,
    bestSingleProtocol: bestProto,
  };
}

function computeBlendedApy(
  ratesBps: Record<ProtocolId, number>,
  allocation: Record<ProtocolId, number>,
): number {
  return PROTOCOLS.reduce((sum, p) => {
    return sum + (ratesBps[p] / 100) * allocation[p];
  }, 0);
}

function rebalance(
  allocation: Record<ProtocolId, number>,
  ratesBps: Record<ProtocolId, number>,
  maxFrac: number,
  idleReserveFrac: number,
): void {
  const deployable = 1 - idleReserveFrac;
  const total = PROTOCOLS.reduce((s, p) => s + ratesBps[p], 0);
  const raw: Record<string, number> = {};
  PROTOCOLS.forEach((p) => {
    raw[p] = Math.min((ratesBps[p] / total) * deployable, maxFrac);
  });
  const rawSum = Object.values(raw).reduce((a, b) => a + b, 0);
  PROTOCOLS.forEach((p) => {
    allocation[p] = (raw[p] / rawSum) * deployable;
  });
}

// ---------------------------------------------------------------------------
// Fallback seed rates when Firebase / API not yet loaded
// ---------------------------------------------------------------------------
// Conservative fallbacks matching current EURC market conditions (~0.2–1% APY)
const FALLBACK_RATES: SeedRates = { drift: 90, kamino: 35, save: 25 };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onChange: (v: number) => void;
  description?: string;
}

function SliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
  description,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="text-sm font-bold tabular-nums text-primary">
          {formatValue(value)}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-secondary">
        {/* Filled track */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-75"
          style={{ width: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={clsx(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
            '[&::-webkit-slider-thumb]:opacity-100',
          )}
          style={{ WebkitAppearance: 'none', appearance: 'none' }}
        />
        {/* Thumb — rendered separately so it sits on top */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary shadow-md border-2 border-background pointer-events-none transition-all duration-75"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>

      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon: React.ElementType;
  positive?: boolean | null;
}

function StatCard({ label, value, sub, accent, icon: Icon, positive }: StatCardProps) {
  const valueColor =
    positive === true
      ? 'text-emerald-400'
      : positive === false
        ? 'text-red-400'
        : accent ?? 'text-foreground';

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide leading-none">
          {label}
        </p>
      </div>
      <p className={clsx('text-xl font-bold tabular-nums leading-none', valueColor)}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground leading-none">{sub}</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const entries = payload as Array<{ name: string; value: number; color: string; dataKey: string }>;

  const formatEurc = (v: number) =>
    v >= 1000
      ? `€${(v / 1000).toFixed(3)}K`
      : `€${v.toFixed(2)}`;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1.5 min-w-[180px]">
      <p className="text-muted-foreground font-medium mb-0.5">Day {(label as number).toFixed(1)}</p>
      {entries.map((e) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-muted-foreground">{e.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: e.color }}>
            {formatEurc(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton for the chart area
// ---------------------------------------------------------------------------
function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded bg-secondary animate-pulse" />
          <div className="h-3.5 w-72 rounded bg-secondary/60 animate-pulse" />
        </div>
        <div className="h-5 w-20 rounded bg-secondary animate-pulse" />
      </div>
      <div className="h-72 w-full rounded-xl bg-secondary/30 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 skeleton-shimmer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default params
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: SimParams = {
  minSpreadBps: 50,
  maxAllocationPct: 70,
  rebalanceCooldownMin: 30,
  idleReservePct: 5,
  initialDepositEurc: 10_000,
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SimulatorPage() {
  usePageTitle('Simulator');
  const { rates, loading: ratesLoading } = useRangerRates();
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<SimResult | null>(null);
  const [computing, setComputing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derive seed rates from live data or fallback
  const seedRates = useMemo<SeedRates>(() => {
    if (!rates) return FALLBACK_RATES;
    return {
      drift: rates.drift.apyBps,
      kamino: rates.kamino.apyBps,
      save: rates.save.apyBps,
    };
  }, [rates]);

  const runSim = useCallback(
    (p: SimParams, sr: SeedRates) => {
      setComputing(true);
      // Yield to the browser to paint the loading state, then compute
      setTimeout(() => {
        const res = runSimulation(p, sr);
        setResult(res);
        setComputing(false);
      }, 0);
    },
    [],
  );

  // Auto-run whenever params or seed rates change (debounced)
  useEffect(() => {
    if (ratesLoading) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSim(params, seedRates), 120);
    return () => clearTimeout(debounceRef.current);
  }, [params, seedRates, ratesLoading, runSim]);

  const setParam = useCallback(<K extends keyof SimParams>(key: K, value: SimParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Chart Y-axis domain: pad 0.5% below initial deposit and 1% above max
  const chartDomain = useMemo<[number | string, number | string]>(() => {
    if (!result) return ['auto', 'auto'];
    const allValues = result.dataPoints.flatMap((d) => [
      d.rangerValue,
      d.holdValue,
      d.bestSingleValue,
    ]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.08;
    return [
      parseFloat((min - pad).toFixed(2)),
      parseFloat((max + pad).toFixed(2)),
    ];
  }, [result]);

  const isLoading = ratesLoading || computing;

  // Seed rate display labels
  const seedRateLabels = PROTOCOLS.map((p) => ({
    id: p,
    label: PROTOCOL_META[p].label,
    color: PROTOCOL_META[p].color,
    apyPct: (seedRates[p] / 100).toFixed(2),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Strategy Simulator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tune strategy parameters and project 30-day vault performance using live protocol rates
            </p>
          </div>

          {/* Live rate pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {seedRateLabels.map(({ id, label, color, apyPct }) => (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                  {apyPct}%
                </span>
              </div>
            ))}
            {!ratesLoading && rates && (
              <span className="text-[10px] text-muted-foreground">live rates</span>
            )}
            {ratesLoading && (
              <span className="text-[10px] text-muted-foreground animate-pulse">loading rates…</span>
            )}
          </div>
        </div>

        {/* Two-column layout: controls left, chart right */}
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 mb-6">

          {/* ── Parameter panel ── */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6 h-fit">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Strategy Parameters</h2>
            </div>

            <SliderControl
              id="spread"
              label="Min Spread Threshold"
              value={params.minSpreadBps}
              min={20}
              max={200}
              step={5}
              formatValue={(v) => `${v} bps`}
              onChange={(v) => setParam('minSpreadBps', v)}
              description="Minimum rate gap between protocols before a rebalance triggers"
            />

            <SliderControl
              id="maxAlloc"
              label="Max Allocation per Protocol"
              value={params.maxAllocationPct}
              min={50}
              max={90}
              step={5}
              formatValue={(v) => `${v}%`}
              onChange={(v) => setParam('maxAllocationPct', v)}
              description="Concentration cap — prevents over-exposure to a single protocol"
            />

            <SliderControl
              id="cooldown"
              label="Rebalance Cooldown"
              value={params.rebalanceCooldownMin}
              min={5}
              max={120}
              step={5}
              formatValue={(v) => `${v} min`}
              onChange={(v) => setParam('rebalanceCooldownMin', v)}
              description="Minimum time between consecutive rebalances"
            />

            <SliderControl
              id="idle"
              label="Idle Reserve"
              value={params.idleReservePct}
              min={0}
              max={15}
              step={1}
              formatValue={(v) => `${v}%`}
              onChange={(v) => setParam('idleReservePct', v)}
              description="Cash buffer kept uninvested for instant liquidity"
            />

            <SliderControl
              id="deposit"
              label="Initial Deposit"
              value={params.initialDepositEurc}
              min={1_000}
              max={100_000}
              step={1_000}
              formatValue={(v) =>
                v >= 1_000 ? `€${(v / 1_000).toFixed(0)}K` : `€${v}`
              }
              onChange={(v) => setParam('initialDepositEurc', v)}
              description="Starting EURC deposited into the vault"
            />

            {/* Reset button */}
            <button
              onClick={() => setParams(DEFAULT_PARAMS)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            >
              Reset to defaults
            </button>
          </div>

          {/* ── Chart panel ── */}
          {isLoading ? (
            <ChartSkeleton />
          ) : result ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    30-Day Portfolio Projection
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    GBM rate simulation · {STEP_MINUTES}-min steps · continuous compounding
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-sm font-bold tabular-nums text-emerald-400">
                    +{result.annualizedApyPct.toFixed(2)}% APY
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={result.dataPoints}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.12)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v: number) => `D${Math.round(v)}`}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `€${(v / 1000).toFixed(1)}K` : `€${v.toFixed(0)}`
                    }
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={chartDomain}
                    width={72}
                  />
                  <Tooltip content={<SimTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                    formatter={(value) => (
                      <span style={{ color: '#94A3B8' }}>{value}</span>
                    )}
                  />

                  {/* Reference line at initial deposit */}
                  <ReferenceLine
                    y={params.initialDepositEurc}
                    stroke="rgba(148,163,184,0.3)"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Deposit',
                      fill: '#64748B',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />

                  {/* Hold EURC baseline — flat, dashed, muted */}
                  <Line
                    type="monotone"
                    dataKey="holdValue"
                    name="Hold EURC (0%)"
                    stroke="#64748B"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: '#64748B' }}
                  />

                  {/* Best single protocol */}
                  <Line
                    type="monotone"
                    dataKey="bestSingleValue"
                    name={`Best Single (${PROTOCOL_META[result.bestSingleProtocol].label})`}
                    stroke={PROTOCOL_META[result.bestSingleProtocol].color}
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: PROTOCOL_META[result.bestSingleProtocol].color }}
                  />

                  {/* Ranger vault — thick, white/primary, prominent */}
                  <Line
                    type="monotone"
                    dataKey="rangerValue"
                    name="Ranger Vault"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#10B981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>

        {/* ── Summary stat cards ── */}
        {!isLoading && result && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
            <StatCard
              label="Total Return"
              value={`+€${result.totalReturnEurc.toFixed(2)}`}
              sub={`${result.totalReturnPct.toFixed(3)}% over 30d`}
              icon={TrendingUp}
              positive={result.totalReturnEurc > 0}
            />
            <StatCard
              label="Annualized APY"
              value={`${result.annualizedApyPct.toFixed(2)}%`}
              sub="projected"
              icon={Percent}
              accent="text-emerald-400"
            />
            <StatCard
              label="Rebalances"
              value={String(result.numRebalances)}
              sub={`~${(result.numRebalances / SIM_DAYS).toFixed(1)}/day`}
              icon={ArrowRightLeft}
              positive={null}
            />
            <StatCard
              label="Alpha vs Best Single"
              value={
                result.alphaVsBestBps >= 0
                  ? `+${result.alphaVsBestBps} bps`
                  : `${result.alphaVsBestBps} bps`
              }
              sub={`vs ${PROTOCOL_META[result.bestSingleProtocol].label}`}
              icon={Activity}
              positive={result.alphaVsBestBps > 0}
            />
            <StatCard
              label="Max Drawdown"
              value={`${result.maxDrawdownPct.toFixed(4)}%`}
              sub="worst peak-to-trough"
              icon={AlertTriangle}
              positive={result.maxDrawdownPct < 0.01 ? true : null}
            />
            <StatCard
              label="Capital Efficiency"
              value={`${result.capitalEfficiencyPct.toFixed(1)}%`}
              sub="time deployed"
              icon={Shield}
              accent="text-foreground"
            />
          </div>
        )}

        {/* Skeleton stat cards */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card px-4 py-4 space-y-2"
              >
                <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
                <div className="h-6 w-20 rounded bg-secondary animate-pulse" />
                <div className="h-3 w-16 rounded bg-secondary/60 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Methodology note */}
        <div className="rounded-xl border border-border bg-card/50 px-5 py-4">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Simulation Methodology</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Rates evolve via Geometric Brownian Motion (σ = 2%/day, clamped 2–25% APY) seeded
                from live protocol rates. Allocation weights toward higher-yield protocols subject to
                the concentration cap. Yield compounds continuously at each{' '}
                {STEP_MINUTES}-minute step. The &ldquo;Best Single&rdquo; baseline holds 100% in the
                highest-rate protocol at T=0 for the full period. Past simulated performance does not
                guarantee future results.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
