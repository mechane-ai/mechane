import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { categoricalLimits } from '../categorical-values.tsx';
import { hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';

/**
 * One column of a bridge; the first is the start total. A change adds its signed value to the running total, and a
 * missing change leaves later levels unknown. A total shows the running total so far, such as a subtotal or the
 * result.
 */
export type BridgeStep = {
  readonly id: string;
  /** The full name used in inspection and exact values. */
  readonly label: string;
  /** A concise axis label, such as "Rent". Absent uses the label. */
  readonly axisLabel?: string | undefined;
  /** Absent means neutral totals, positive increases and negative decreases. */
  readonly tone?: ChartTone | undefined;
} & (
  | { readonly kind: 'start'; readonly value: number }
  | { readonly kind: 'change'; readonly value: number | null }
  | { readonly kind: 'total'; readonly value?: never }
);

/** A step positioned on the value axis. A null level means an earlier missing change made it unknown. */
export type BridgeLevel = {
  readonly step: BridgeStep;
  readonly from: number | null;
  readonly to: number | null;
  readonly tone: ChartTone;
};

function defaultTone(step: BridgeStep): ChartTone {
  if (step.kind !== 'change' || step.value === null) {
    return 'neutral';
  }

  return step.value < 0 ? 'negative' : 'positive';
}

/** The running total after a step, or null when the start is absent or an earlier change is missing. */
function runningAfter(steps: ReadonlyArray<BridgeStep>): number | null {
  const amounts = steps.map((step) => (step.kind === 'total' ? 0 : step.value));

  if (steps[0]?.kind !== 'start' || amounts.includes(null)) {
    return null;
  }

  return amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0);
}

function levelOf({
  step,
  before,
  after,
}: {
  readonly step: BridgeStep;
  readonly before: number | null;
  readonly after: number | null;
}): BridgeLevel {
  const tone = step.tone ?? defaultTone(step);

  switch (step.kind) {
    case 'start':
      return { step, from: 0, to: step.value, tone };
    case 'total':
      return { step, from: after === null ? null : 0, to: after, tone };
    case 'change':
      return { step, from: before, to: after, tone };
  }
}

/** Stacks the supplied changes into running levels; totals start at zero and missing changes stay unknown. */
export function bridgeLevels(steps: ReadonlyArray<BridgeStep>): ReadonlyArray<BridgeLevel> {
  return steps.map((step, index) =>
    levelOf({ step, before: runningAfter(steps.slice(0, index)), after: runningAfter(steps.slice(0, index + 1)) }),
  );
}

type ValueDomain = readonly [number, number];

export function bridgeDomain(levels: ReadonlyArray<BridgeLevel>): ValueDomain {
  const values = levels.flatMap((level) => [level.from, level.to].filter((value) => value !== null));
  const lowest = Math.min(0, ...values);
  const highest = Math.max(0, ...values);

  return lowest === highest ? [lowest, lowest + 1] : [lowest, highest];
}

export function validateBridge({
  steps,
  domain,
}: {
  readonly steps: ReadonlyArray<BridgeStep>;
  readonly domain?: ValueDomain | undefined;
}): string | undefined {
  if (steps.length > categoricalLimits.items) {
    return `Choose a bridge with at most ${categoricalLimits.items} steps.`;
  }

  if (!hasUniqueIds(steps)) {
    return 'Bridge steps require unique identifiers.';
  }

  if (steps.length > 0 && steps[0]?.kind !== 'start') {
    return 'A bridge begins with one start step.';
  }

  if (steps.filter((step) => step.kind === 'start').length > 1) {
    return 'A bridge has exactly one start step.';
  }

  const hasNonfiniteValue = steps.some((step) => {
    const value = step.kind === 'total' ? null : step.value;

    return value !== null && !Number.isFinite(value);
  });

  if (hasNonfiniteValue) {
    return 'Bridge values must be finite numbers or explicit missing changes.';
  }

  const levels = bridgeLevels(steps);
  const reached = bridgeDomain(levels);

  if (domain === undefined) {
    return Number.isFinite(reached[0]) && Number.isFinite(reached[1]) ? undefined : 'Running totals must stay finite.';
  }

  const isContained = domain[0] <= reached[0] && domain[1] >= reached[1];

  if (!isFiniteDomain(domain) || !isContained) {
    return 'The bridge domain must be finite, increasing, and contain zero and every running total.';
  }

  return undefined;
}
