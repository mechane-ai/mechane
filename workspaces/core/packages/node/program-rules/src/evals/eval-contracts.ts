import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { evalGradingIsolation } from './eval-grading-isolation.ts';
import { evalProductionPath } from './eval-production-path.ts';
import { evalRunLifecycle } from './eval-run-lifecycle.ts';
import { evalScoreAccounting } from './eval-score-accounting.ts';

/** The registry's entry for each contract of the evals section, in the order of their folders. */
export const EVAL_CONTRACTS = {
  'eval-run-lifecycle': evalRunLifecycle,
  'eval-grading-isolation': evalGradingIsolation,
  'eval-production-path': evalProductionPath,
  'eval-score-accounting': evalScoreAccounting,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
