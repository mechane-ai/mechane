import type { OptOuts } from '@mechane/rules';

/** The opt-out list of the measuring run, which turns no rule off. */
export const NO_OPT_OUTS: Readonly<OptOuts> = { pending: [], decided: {} };

/**
 * What the checks program does: run the owned checks, lint, tighten the ratchets' baselines, or merge a baseline's
 * versions. It also prints, records or compares the fingerprint, and prints the changed set. Last, it measures the
 * rules, appends to the locks, runs the normalizers, or applies the enforced autofixes or one rule's.
 */
export const ChecksCommand = {
  Check: 'check',
  Lint: 'lint',
  Tighten: 'tighten',
  Merge: 'merge',
  Fingerprint: 'fingerprint',
  Record: 'record',
  Compare: 'compare',
  Changed: 'changed',
  Measure: 'measure',
  Lock: 'lock',
  Normalize: 'normalize',
  Fix: 'fix',
} as const;

export type ChecksCommand = (typeof ChecksCommand)[keyof typeof ChecksCommand];

/** The registry's source, relative to the workspace, where each rule declares its status, phase and examples. */
export const REGISTRY = 'packages/node/rules/src';
