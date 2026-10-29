import { wireStruct } from '@mechane/records';
import { check, CLI_BINARY, cliResult, finishedCli, signedInAccount } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import { EvalCase, EvalPath, SUITE } from './constants.ts';
import { expectationTexts } from './expectation-texts.ts';
import { suiteFolder } from './suite-folder.ts';

/** The verdict each case's trial must report, in the suite's order. */
const EXPECTED_VERDICTS = [`${EvalCase.Graded} pass`, `${EvalCase.Ungraded} no_grade`] as const;

/** The status of an eval run with a trial that failed to run or grade, which the CLI declares as `Failed`. */
const INCOMPLETE_RUN_STATUS = 1;

/**
 * The requests the run sends the upstream: each case's subject turn, then its grader turn, one dispatch each. The
 * trials run one after another, so every other request, from the first, is a subject's.
 */
const EXPECTED_REQUESTS = 4;

/** The places in the run's requests of each trial's two turns: the subject's, then the grader's. */
const TRIAL_TURNS = 2;

/** The fields of an eval run's report that the scenario reads: each trial's case and verdict. */
const EvalReport = Schema.Struct({
  trials: Schema.Array(wireStruct({ fields: { caseId: Schema.String, verdict: Schema.String } })),
});

type EvalReport = typeof EvalReport.Type;

/** One trial of an eval run's report. */
type EvalTrial = EvalReport['trials'][number];

/**
 * Runs a suite of two cases through the deployment with the built CLI: the graded case's grader answers with a grade,
 * and the ungraded case's grader with text. The run must end incomplete, report pass then no_grade, and send each
 * trial's two turns, no subject's request holding an expectation's text.
 */
export const evalRunGradesEachCaseThroughTheDeployment = Effect.fn('evalRunGradesEachCaseThroughTheDeployment')(
  function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
    const account = yield* signedInAccount({ stack });
    const folder = yield* suiteFolder({ stack });
    const before = stack.modelUpstream.requests().length;
    const args = ['eval', 'run', '--suite', join(folder, EvalPath.Suite), '--out-folder', join(folder, EvalPath.Out)];
    const { environment } = account;
    const finished = yield* finishedCli({ stack, binary: CLI_BINARY, args, environment });
    const run = yield* cliResult({ args, run: finished, result: EvalReport, status: INCOMPLETE_RUN_STATUS });
    const verdictLine: (trial: EvalTrial) => string = (trial) => `${trial.caseId} ${trial.verdict}`;
    const verdicts = run.result.trials.map(verdictLine);
    const requests = stack.modelUpstream.requests().slice(before);

    const subjectBodies = requests
      .filter((_, index) => index % TRIAL_TURNS === 0)
      .map(({ body }) => body)
      .join('\n');

    const seen = expectationTexts({ cases: SUITE.cases }).filter((text) => subjectBodies.includes(text));

    yield* check({
      name: guarantee,
      conditions: [
        verdicts.join(', ') === EXPECTED_VERDICTS.join(', '),
        requests.length === EXPECTED_REQUESTS,
        seen.length === 0,
      ],
      detail: `the report holds ${verdicts.join(', ')}, the upstream received ${requests.length} requests, and the subjects' requests held [${seen.join(', ')}]`,
    });
  },
);
