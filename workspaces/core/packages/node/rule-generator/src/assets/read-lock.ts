import { ContractLock } from '@mechane/rule-shapes';
import { Effect, Schema } from 'effect';
import { GenerateStep } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from '../files/read-input.ts';

/** The lock of the installed contracts, `.tenet.lock` in the factory's root, relative to the workspace. */
const CONTRACT_LOCK = '../../.tenet.lock';

/** The lock as JSON. */
const ContractLockJson = Schema.fromJsonString(ContractLock);

/** The lock of the installed contracts: each contract's file, with the asset files it ships. */
export const readLock = Effect.fn('readLock')(function* (): Effect.fn.Return<ContractLock, GenerateFailed> {
  const text = yield* readInput({ path: CONTRACT_LOCK });

  /** A lock that does not decode, at its path. */
  const unreadableLock: (error: Schema.SchemaError) => GenerateFailed = (error) =>
    new GenerateFailed({ step: GenerateStep.Read, path: CONTRACT_LOCK, reason: error.message });

  return yield* Schema.decodeUnknownEffect(ContractLockJson)(text).pipe(Effect.mapError(unreadableLock));
});
