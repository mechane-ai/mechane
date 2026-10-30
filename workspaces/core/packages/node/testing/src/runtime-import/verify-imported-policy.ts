import { LOCAL_OWNER_IDENTITY } from '@mechane/records';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { checkMaskedImportPolicy } from './check-masked-import-policy.ts';

type VerifyImportedPolicyInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** The fixture preserves its administrator grant across both sides of the temporary installation change. */
export const verifyImportedPolicy = Effect.fn('verifyImportedPolicy')(function* ({
  ...input
}: VerifyImportedPolicyInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const { stack } = input;
  const administratorIdentities = JSON.stringify([LOCAL_OWNER_IDENTITY]);
  const disabled = stack.restart({ variables: { administratorIdentities, isSandboxEnabled: 'false' } });
  const restored = stack.restart({ variables: { administratorIdentities } });

  yield* Effect.acquireRelease(disabled, () => Effect.orDie(restored));
  yield* checkMaskedImportPolicy(input);
}, Effect.scoped);
