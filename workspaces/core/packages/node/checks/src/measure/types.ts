import type { ContractName, RegisteredRule, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/**
 * What the measuring run found: the findings of each rule by the key they count under, every rule of oxlint's
 * categories, and every oxlint rule whose fix `oxlint --fix` applies. It also holds the compiler's errors with each
 * proposed option set.
 */
export type Measurement = {
  readonly counts: ReadonlyMap<string, number>;
  readonly categorized: ReadonlySet<string>;
  readonly fixable: ReadonlySet<string>;
  readonly compilerErrors: number;
};

/** The rules the run counts, what it found, and the pending list it computes. */
export type MeasureFindingsInput = {
  readonly rules: ReadonlyArray<RegisteredRule>;
  readonly measurement: Measurement;
  readonly pending: ReadonlyArray<string>;
};

/** A rule the measuring run counts: its contract, the key its findings count under, its rollout, and its findings. */
export type CountedRule = {
  readonly contract: ContractName;
  readonly key: string;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
  readonly count: number;
};
