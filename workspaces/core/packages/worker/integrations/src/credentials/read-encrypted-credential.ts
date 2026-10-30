import { CredentialReading, workspaceStub } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Result, Schema } from 'effect';
import type { ResolveIntegrationSecretInput } from '../types.ts';
import type { IntegrationSecretInvalid } from './errors.ts';
import { failIntegrationSecret } from './fail-integration-secret.ts';

/** Storage outages remain distinct from absent references, so callers retry without substituting credentials. */
export async function readEncryptedCredential({
  settings,
  workspaceId,
  secretReference,
}: ResolveIntegrationSecretInput): Promise<Result.Result<typeof CredentialReading.Type, IntegrationSecretInvalid>> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const pending = workspace.credential({ secretReference });
  const stored = await capturePromise({ promise: pending });

  if (Result.isFailure(stored)) {
    return failIntegrationSecret();
  }

  const decoded = Schema.decodeUnknownResult(CredentialReading)(stored.success);

  if (Result.isFailure(decoded)) {
    return failIntegrationSecret();
  }

  return Result.succeed(decoded.success);
}
