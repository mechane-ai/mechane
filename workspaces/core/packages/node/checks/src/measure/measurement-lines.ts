import { RolloutPhase } from '@mechane/rule-shapes';
import { OPT_OUTS } from './constants.ts';
import { countedRules } from './counted-rules.ts';
import type { CountedRule, MeasureFindingsInput } from './types.ts';

type MeasurementLinesInput = MeasureFindingsInput;

/**
 * The measurement as lines: each rollout rule with its findings, status and phase, then each other rule with findings.
 * The pending list follows as the registry's opt-out list holds it.
 */
export function measurementLines({ rules, measurement, pending }: MeasurementLinesInput): ReadonlyArray<string> {
  const rollouts = countedRules({ rules, measurement }).filter(({ phase }) => phase !== RolloutPhase.Adopted);
  const keys: ReadonlySet<string> = new Set(rollouts.map(({ key }) => key));

  /** Whether a counted key belongs to no rule of the rollout. */
  const isOther: (entry: readonly [string, number]) => boolean = ([key]) => !keys.has(key);
  const others = [...measurement.counts].filter(isOther).toSorted(([left], [right]) => left.localeCompare(right));

  /** A rollout rule's line: its standard, key, findings, status and phase. */
  const rolloutLine: (counted: CountedRule) => string = ({ standard, key, count, status, phase }) =>
    `${standard} ${key} ${String(count)} ${status} ${phase}`;

  /** Another rule's line: its key and findings. */
  const otherLine: (entry: readonly [string, number]) => string = ([key, count]) => `${key} ${String(count)}`;

  return [
    ...rollouts.map(rolloutLine),
    '',
    ...others.map(otherLine),
    '',
    `The pending list of ${OPT_OUTS}, which a sweep shortens:`,
    JSON.stringify(pending),
  ];
}
