import { PrivateMode } from '@mechane/program';
import { CredentialMetadata, ExecutionAccessState, Mech } from '@mechane/protocol';
import { check, commandReply, FileStep, FileStepFailed, heldMech, runCli, signedInMech } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Array, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Uses the scanned upstream sentinel to detect credentials in receipts, model requests, databases, and files. */
export const executionAccessIsScopedAndTransient = Effect.fn('executionAccessIsScopedAndTransient')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const file = join(mech.account.configurationRoot, 'execution-credential');

  yield* Effect.tryPromise({
    try: () => writeFile(file, stack.modelUpstream.apiKey, { mode: PrivateMode.File }),
    catch: () =>
      new FileStepFailed({ step: FileStep.Write, path: file, reason: 'could not write execution credential fixture' }),
  });

  yield* runCli({
    stack,
    environment: mech.account.environment,
    args: ['credential', 'put', 'execution-test', '--file', file],
    result: CredentialMetadata,
  });

  const access = {
    github: null,
    variables: { EXECUTION_LABEL: 'approved-environment' },
    secrets: { EXECUTION_TEST_SECRET: 'execution-test' },
  };

  const configuration = JSON.stringify(access);

  yield* mech.command({
    words: ['execution-access', 'set'],
    ids: ['--access', configuration],
    result: ExecutionAccessState,
  });

  const output = yield* commandReply({
    mech,
    command: String.raw`printf "%s\n" "$EXECUTION_LABEL" "$EXECUTION_TEST_SECRET"`,
  });

  const fork = yield* mech.command({ words: ['mech', 'fork'], ids: ['--name', 'ungranted-fork'], result: Mech });

  const forkAccess = yield* runCli({
    stack,
    environment: mech.account.environment,
    args: ['execution-access', 'show', fork.id],
    result: ExecutionAccessState,
  });

  if (Option.isNone(fork.forkedFrom)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'the fork has no recorded origin' });
  }

  const forked = yield* heldMech({
    stack,
    account: mech.account,
    mechId: fork.id,
    after: fork.forkedFrom.value.sequence,
  });

  const isolated = yield* commandReply({
    mech: forked,
    command: 'test -z "$EXECUTION_TEST_SECRET" && test -z "$EXECUTION_LABEL" && printf fork-isolated',
  });

  const beforeRestart = yield* mech.logged({ after: 0 });
  const last = Array.last(beforeRestart);

  if (Option.isNone(last)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'the completed command left no event' });
  }

  yield* stack.restart({ variables: {} });

  const reopened = yield* heldMech({ stack, account: mech.account, mechId: mech.id, after: last.value.sequence });

  const restored = yield* commandReply({
    mech: reopened,
    command: 'test -n "$EXECUTION_TEST_SECRET" && printf credentials-ready',
  });

  yield* mech.command({ words: ['execution-access', 'set'], ids: ['--access', 'null'], result: ExecutionAccessState });

  const revoked = yield* commandReply({
    mech: reopened,
    command: 'test -z "$EXECUTION_TEST_SECRET" && test -z "$EXECUTION_LABEL" && printf access-revoked',
  });

  const conditions = [
    output.includes('approved-environment'),
    output.includes('[redacted]'),
    !output.includes(stack.modelUpstream.apiKey),
    Option.isNone(forkAccess.result.access),
    isolated.includes('fork-isolated'),
    restored.includes('credentials-ready'),
    revoked.includes('access-revoked'),
  ];

  yield* check({
    name: guarantee,
    conditions,
    detail:
      'execution credentials must be available only while granted and redacted before a receipt reaches the agent',
  });
}, Effect.scoped);
