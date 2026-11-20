import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { createEvalTarget, EvalOutcome, evalRunnerFingerprint, runReplyEval } from '@mechane/eval';
import type { EvalTarget, WriteProgress } from '@mechane/eval';
import { writeDiagnostic } from '@mechane/program';
import { Effect, Option } from 'effect';
import { withWorkspace } from './with-workspace.ts';

/** The outcome of the command by how its eval run ended: an incomplete run fails the command. */
const EVAL_RUN_OUTCOME: Readonly<Record<EvalOutcome, RunOutcome>> = {
  [EvalOutcome.Completed]: RunOutcome.Completed,
  [EvalOutcome.Incomplete]: RunOutcome.Incomplete,
};

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);
const EMBEDDED_MODULE_PATH_PREFIX = '/$bunfs/';

/** The eval's progress goes to standard error, and its report is the command's result. */
export const runEvalRun = Effect.fn('runEvalRun')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
  program,
  write,
}: CommandRunInput<'eval run'>): Effect.fn.Return<RunOutcome, RunFailure> {
  const { suiteFile, outFolder } = input;
  const writeProgress: WriteProgress = ({ line }) => writeDiagnostic({ program: PROGRAM, line });
  const moduleUrl = new URL(import.meta.url);

  const binaryPath: Option.Option<string> = (() => {
    if (Option.isSome(program.binary)) {
      return Option.some(program.binary.value.path);
    }

    if (moduleUrl.pathname.startsWith(EMBEDDED_MODULE_PATH_PREFIX)) {
      return Option.some(program.executablePath);
    }

    return Option.none();
  })();

  const artifactIdentity = yield* evalRunnerFingerprint({ moduleUrl, binaryPath });

  const kind: EvalTarget['kind'] = (() => {
    if (LOOPBACK_HOSTS.has(origin.hostname)) {
      return 'local';
    }

    return 'hosted';
  })();

  const target = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: (access) =>
      createEvalTarget({ origin, token: access.token, workspaceId: access.workspaceId, kind, artifactIdentity }),
  });

  const run = yield* runReplyEval({ suiteFile, target, outFolder, writeProgress });

  write({ result: { lines: run.lines, result: run.report } });

  return EVAL_RUN_OUTCOME[run.outcome];
});
