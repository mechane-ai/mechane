import { resolveIntegrationSecret } from '@mechane/integrations';
import type { IntegrationSecretInvalid } from '@mechane/integrations';
import { Option, Result } from 'effect';
import type { Redacted } from 'effect';
import type { RunGrantedToolInput } from './types.ts';

type ReadGrantedTokenInput = Pick<RunGrantedToolInput, 'settings' | 'workspaceId' | 'granted'>;

/** An unavailable credential never turns an authenticated connection into an anonymous request. */
export async function readGrantedToken({
  settings,
  workspaceId,
  granted,
}: ReadGrantedTokenInput): Promise<Result.Result<Option.Option<Redacted.Redacted>, IntegrationSecretInvalid>> {
  const reference = granted.connection.secretReference;

  if (Option.isNone(reference)) {
    const missing = Option.none();

    return Result.succeed(missing);
  }

  return await resolveIntegrationSecret({ settings, workspaceId, secretReference: reference.value });
}
