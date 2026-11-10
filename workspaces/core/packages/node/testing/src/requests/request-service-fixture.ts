import { PrivateMode } from '@mechane/program';
import { CredentialMetadata, ExecutionAccessState } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../cli/run-cli.ts';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import { startRequestService } from './start-request-service.ts';
import type { LocalRequestService } from './start-request-service.ts';

type RequestServiceFixtureInput = StackInput & { readonly mech: TalkingMech };

/** Each request fixture stores its host-only credential under this reference. */
export const REQUEST_SERVICE_REFERENCE = 'request-service';

/** The token is the stack's scanned sentinel, granted to the host alone through the ordinary owner CLI. */
export const requestServiceFixture = Effect.fn('requestServiceFixture')(function* ({
  stack,
  mech,
}: RequestServiceFixtureInput): Effect.fn.Return<LocalRequestService, ScenarioFailure, Scope.Scope> {
  const service = yield* startRequestService({ token: stack.modelUpstream.apiKey });
  const file = join(mech.account.configurationRoot, 'request-service-credential');

  yield* Effect.tryPromise({
    try: () => writeFile(file, stack.modelUpstream.apiKey, { mode: PrivateMode.File }),
    catch: () => new FileStepFailed({ step: FileStep.Write, path: file, reason: 'could not write request credential' }),
  });

  yield* runCli({
    stack,
    environment: mech.account.environment,
    args: ['credential', 'put', REQUEST_SERVICE_REFERENCE, '--file', file],
    result: CredentialMetadata,
  });

  const access = {
    github: null,
    variables: {},
    secrets: {},
    request_service: { url: service.url.href, secret_reference: REQUEST_SERVICE_REFERENCE },
  };

  const configuration = JSON.stringify(access);

  yield* mech.command({
    words: ['execution-access', 'set'],
    ids: ['--access', configuration],
    result: ExecutionAccessState,
  });

  return service;
});
