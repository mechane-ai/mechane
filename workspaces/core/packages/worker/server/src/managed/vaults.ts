import { ManagedStoreError } from '@mechane/control-store';
import { HttpStatusCode } from '@mechane/records';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';

export async function handleVaults({ operation, params, query, body, scope, store }: ManagedRequest): Promise<unknown> {
  const vaults = store.managed.vaults;

  switch (operation) {
    case 'BetaCreateVault':
      return await vaults.create(scope, body);
    case 'BetaListVaults':
      return await vaults.list(scope, managedPageQuery(query));
    default:
      break;
  }

  const vaultId = params['vault_id'];

  if (vaultId === undefined) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Missing vault ID');
  }

  switch (operation) {
    case 'BetaGetVault':
      return await vaults.get(scope, vaultId);
    case 'BetaUpdateVault':
      return await vaults.update(scope, vaultId, body);
    case 'BetaDeleteVault':
      return await vaults.delete(scope, vaultId);
    case 'BetaArchiveVault':
      return await vaults.archive(scope, vaultId);
    case 'BetaCreateCredential':
      return await vaults.credentials.create(scope, vaultId, body);
    case 'BetaListCredentials':
      return await vaults.credentials.list(scope, vaultId, managedPageQuery(query));
    default:
      break;
  }

  const credentialId = params['credential_id'];

  if (credentialId === undefined) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Missing credential ID');
  }

  switch (operation) {
    case 'BetaGetCredential':
      return await vaults.credentials.get(scope, vaultId, credentialId);
    case 'BetaUpdateCredential':
      return await vaults.credentials.update({ scope, vaultId, id: credentialId, body });
    case 'BetaDeleteCredential':
      return await vaults.credentials.delete(scope, vaultId, credentialId);
    case 'BetaArchiveCredential':
      return await vaults.credentials.archive(scope, vaultId, credentialId);
    case 'BetaValidateCredential':
      return await vaults.credentials.validateOAuth(scope, vaultId, credentialId);
    default:
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown vault operation');
  }
}
