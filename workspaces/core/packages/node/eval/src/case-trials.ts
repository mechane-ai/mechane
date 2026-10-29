import type { Case } from './schemas.ts';
import type { Trial } from './store/schemas.ts';

/** A trial of the plan, with the case it runs. */
type CaseTrial = { readonly evalCase: Case; readonly trial: Trial };

type CaseTrialsInput = { readonly cases: ReadonlyArray<Case>; readonly trials: ReadonlyArray<Trial> };

/** Each trial of a plan with the case it runs, in the suite's order of cases, then the plan's order of trials. */
export function caseTrials({ cases, trials }: CaseTrialsInput): ReadonlyArray<CaseTrial> {
  const trialsOfCase: (evalCase: Case) => ReadonlyArray<CaseTrial> = (evalCase) =>
    trials.filter(({ caseId }) => caseId === evalCase.id).map((trial) => ({ evalCase, trial }));

  return cases.flatMap(trialsOfCase);
}
