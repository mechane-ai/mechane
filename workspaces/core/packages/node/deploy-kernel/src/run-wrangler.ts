import { finishedProcess, StepSubject } from '@mechane/program';
import { EMPTY_DOTENV, WRANGLER } from '@mechane/release';
import { Effect, Redacted } from 'effect';
import { CREDENTIAL_VARIABLES, DeployStep, WRANGLER_METRICS } from './constants.ts';
import { DeployFailed } from './errors.ts';
import type { WranglerInput, WranglerVariablesInput } from './types.ts';

/**
 * Runs a Wrangler command against the operator's account, with no env file loaded, and answers with what it printed to
 * standard output.
 */
export function runWrangler({
  args,
  settings,
  credentials,
  timeout,
}: WranglerInput): Effect.Effect<string, DeployFailed> {
  const subjects = [StepSubject.cases.Command.make({ args })];

  return finishedProcess({
    command: WRANGLER,
    args: [...args, ...EMPTY_DOTENV],
    environment: wranglerVariables({ settings, credentials }),
    timeout,
  }).pipe(
    Effect.map(({ stdout }) => stdout),
    Effect.mapError(({ reason }) => new DeployFailed({ step: DeployStep.RunWrangler, subjects, reason })),
  );
}

/**
 * The variables a Wrangler child runs with: the inherited ones, its debug log's folder, no usage metrics, and the
 * operator's Cloudflare token and account, under the names Wrangler reads.
 */
export function wranglerVariables({ settings, credentials }: WranglerVariablesInput): Readonly<Record<string, string>> {
  return {
    ...settings.inherited,
    ...settings.wranglerLog,
    ...WRANGLER_METRICS,
    [CREDENTIAL_VARIABLES.cloudflareApiToken]: Redacted.value(credentials.cloudflareApiToken),
    [CREDENTIAL_VARIABLES.cloudflareAccountId]: Redacted.value(credentials.cloudflareAccountId),
  };
}
