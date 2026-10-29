import { ContractLock } from '@mechane/rule-shapes';
import { Effect } from 'effect';
import { join } from 'node:path';
import { FACTORY_FOLDER } from '../constants.ts';
import { decodeFile } from '../decode-file.ts';
import type { InputUnreadable } from '../errors.ts';

/** The lock of the installed contracts, in the factory's root. */
const CONTRACT_LOCK = '.tenet.lock';

/** The lock of the installed contracts: each contract's file from the factory's root, with the asset files it ships. */
export const contractLock = Effect.fn('contractLock')(function* (): Effect.fn.Return<ContractLock, InputUnreadable> {
  const path = join(FACTORY_FOLDER, CONTRACT_LOCK);

  return yield* decodeFile({ path, schema: ContractLock });
});
