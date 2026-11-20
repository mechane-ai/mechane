import { RequestInvalid } from '@mechane/protocol';
import { Record } from 'effect';
import type { ExecutionAccess } from '../../../domain.ts';

export function executionCredentialReferences(access: ExecutionAccess): ReadonlyArray<string> {
  const references = Record.values(access.secrets);

  if (Record.keys(access.variables).some((name) => Object.hasOwn(access.secrets, name))) {
    throw new RequestInvalid({ reason: 'an execution variable cannot also name a secret' });
  }

  return references;
}
