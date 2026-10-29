import {
  DeployFailed,
  DeployStep,
  PROGRAM,
  RELEASE_TAG,
  runWrangler,
  SecretsFile,
  temporaryFolder,
} from '@mechane/deploy-kernel';
import type { OperatorModeInput, OperatorSettingsInput } from '@mechane/deploy-kernel';
import { PrivateMode, StepSubject, writeDiagnostic } from '@mechane/program';
import { Effect, Record, Redacted, Schema } from 'effect';
import type { Scope } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEPLOY_TIMEOUT, SECRETS_FILE } from './constants.ts';

/**
 * Deploys the rendered configuration and all selected secrets in the same tagged Worker version. Wrangler refuses
 * changes to remote configuration made outside this release workflow.
 */
export function uploadWorker({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  const args = [
    'deploy',
    '--config',
    rendered.configurationPath,
    '--strict',
    '--tag',
    RELEASE_TAG,
    '--message',
    rendered.revision,
  ];

  const { credentials } = settings;

  return Effect.scoped(
    Effect.gen(function* () {
      const path = yield* secretsFile({ settings });

      yield* runWrangler({ args: [...args, '--secrets-file', path], settings, credentials, timeout: DEPLOY_TIMEOUT });
      writeDiagnostic({ program: PROGRAM, line: `deploy: Wrangler deployed ${RELEASE_TAG} with all secrets` });
    }),
  );
}

/**
 * The Worker's credentials as a file in a fresh folder only its owner opens. The scope's close removes it, a stop
 * signal's included, so no value reaches a command line or an output.
 */
function secretsFile({ settings }: OperatorSettingsInput): Effect.Effect<string, DeployFailed, Scope.Scope> {
  const values: Readonly<Record<string, Redacted.Redacted>> = settings.credentials.secrets;
  const secrets = Record.map(values, (value) => Redacted.value(value));

  return Effect.gen(function* () {
    const path = join(yield* temporaryFolder({ settings }), SECRETS_FILE);
    // The secrets are the text of decoded credentials, so encoding them to the file's schema cannot fail.
    const text = yield* Schema.encodeEffect(SecretsFile)(secrets).pipe(Effect.orDie);
    const subjects = [StepSubject.cases.Path.make({ path })];

    yield* Effect.tryPromise({
      try: () => writeFile(path, text, { mode: PrivateMode.File }),
      catch: (cause) => new DeployFailed({ step: DeployStep.WriteSecretsFile, subjects, reason: String(cause) }),
    });

    return path;
  });
}
