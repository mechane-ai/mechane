import type { ClientFailure } from '@mechane/client';
import { Effect, Option } from 'effect';
import type { ImportWorkspaceInput } from './types.ts';

type ImportWorkspacePolicyInput = Pick<ImportWorkspaceInput, 'call' | 'token' | 'workspaceId' | 'document'>;

/** Applies a supplied administrator policy through create-only writes, leaving existing runtime policy intact. */
export const importWorkspacePolicy = Effect.fn('importWorkspacePolicy')(function* ({
  call,
  token,
  workspaceId,
  document,
}: ImportWorkspacePolicyInput): Effect.fn.Return<boolean, ClientFailure> {
  if (Option.isNone(document.policy)) {
    return false;
  }

  const policy = document.policy.value;
  const input = { workspaceId, policy, isCreateOnly: true };

  yield* call({ name: 'setWorkspacePolicy', input, credential: token });

  return true;
});
