import { sha256Hex } from '@mechane/program';
import type { Readiness } from '@mechane/protocol';
import { Array, Schema } from 'effect';
import { PLAN_VERSION } from './constants.ts';
import { PlanBasis } from './schemas.ts';
import type { Case, Suite } from './schemas.ts';
import type { Plan, Trial } from './store/schemas.ts';
import { trialId } from './trial-id.ts';

/** A suite, the deployment it runs against, and the workspace whose mechs run it. */
type BuildPlanInput = { readonly suite: Suite; readonly readiness: Readiness; readonly workspaceId: string };

type PlanTrialsInput = { readonly digest: string; readonly suite: Suite };

/**
 * The plan of a suite against a deployment and a workspace, whose digest is the SHA-256 of its basis's canonical
 * encoding: the schema's fields in their declared order, without whitespace.
 */
export function buildPlan({ suite, readiness, workspaceId }: BuildPlanInput): Plan {
  const { release, workerRevision } = readiness;
  const basis: PlanBasis = { version: PLAN_VERSION, suite, release, workerRevision, workspaceId };

  // The run built the basis to the schema's type, so encoding it cannot fail.
  const digest = sha256Hex({ contents: JSON.stringify(Schema.encodeSync(PlanBasis)(basis)) });

  return { basis, digest, trials: planTrials({ digest, suite }) };
}

/** Each case's trials, one for each repeat, in the suite's order. */
function planTrials({ digest, suite }: PlanTrialsInput): ReadonlyArray<Trial> {
  const repeats = Array.range(1, suite.repeats);

  const caseTrials: (evalCase: Case) => ReadonlyArray<Trial> = ({ id: caseId }) => {
    const trial: (repeat: number) => Trial = (repeat) => ({ id: trialId({ digest, caseId, repeat }), caseId, repeat });

    return repeats.map(trial);
  };

  return suite.cases.flatMap(caseTrials);
}
