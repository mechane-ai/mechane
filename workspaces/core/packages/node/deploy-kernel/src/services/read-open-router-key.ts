import { WORKER_VARIABLES } from '@mechane/deployment';
import { Effect } from 'effect';
import { API_ORIGINS, DeployStep } from '../constants.ts';
import type { DeployFailed } from '../errors.ts';
import type { Credentials } from '../schemas.ts';
import { readJson } from './read-json.ts';
import { OpenRouterKey } from './schemas.ts';
import type { OpenRouterCredit } from './types.ts';

type CredentialsInput = { readonly credentials: Credentials };

/** What OpenRouter reports of the production key: its credit limit, which must be set, its usage and credit left. */
export function readOpenRouterKey({ credentials }: CredentialsInput): Effect.Effect<OpenRouterCredit, DeployFailed> {
  return readJson({
    url: new URL(API_ORIGINS.openRouterKey),
    init: {},
    token: credentials.secrets[WORKER_VARIABLES.modelApiKey],
    schema: OpenRouterKey,
    step: DeployStep.ReadOpenRouterCredit,
  }).pipe(Effect.map(({ key }) => key));
}
