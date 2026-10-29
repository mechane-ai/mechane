import { API_ORIGINS, DeployStep, PROGRAM, readJson, readOpenRouterKey } from '@mechane/deploy-kernel';
import type { Credentials, DeployFailed, OpenRouterCredit } from '@mechane/deploy-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Effect, Option, Redacted } from 'effect';
import { CloudflareAccount } from './schemas.ts';

type CheckAccountsInput = { readonly credentials: Credentials; readonly modelUpstream: URL };

/** Only an OpenRouter installation sends its model key to OpenRouter's account endpoint. */
export function checkAccounts({
  credentials,
  modelUpstream,
}: CheckAccountsInput): Effect.Effect<Option.Option<OpenRouterCredit>, DeployFailed> {
  const account = Redacted.value(credentials.cloudflareAccountId);

  return Effect.gen(function* () {
    const { result } = yield* readJson({
      url: new URL(`${API_ORIGINS.cloudflare}/accounts/${account}`),
      init: {},
      token: credentials.cloudflareApiToken,
      schema: CloudflareAccount,
      step: DeployStep.ReadCloudflareAccount,
    });

    writeDiagnostic({ program: PROGRAM, line: `cloudflare: the token reads the account ${result.name}` });

    if (modelUpstream.origin !== new URL(API_ORIGINS.openRouterKey).origin) {
      writeDiagnostic({
        program: PROGRAM,
        line: `model: ${modelUpstream.origin} uses its configured key; no model request was made`,
      });

      return Option.none();
    }

    const key = yield* readOpenRouterKey({ credentials });

    writeDiagnostic({
      program: PROGRAM,
      line: `openrouter: the key's credit limit is $${key.limitDollars}, with $${key.remainingDollars} left`,
    });

    return Option.some(key);
  });
}
