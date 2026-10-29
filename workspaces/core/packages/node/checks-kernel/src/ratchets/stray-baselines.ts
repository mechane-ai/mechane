import { Array, Effect } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_FOLDER, WORKSPACE_FOLDER } from '../constants.ts';
import type { InputUnreadable } from '../errors.ts';
import { listFiles } from '../list-files.ts';
import type { Ratchet } from '../types.ts';
import { baselinePath } from './baseline-path.ts';
import { BASELINE_EXTENSION } from './constants.ts';

type RatchetsInput = { readonly ratchets: ReadonlyArray<Ratchet> };

/** Each baseline file no ratchet declares, such as the one of a rule that became enforced; none while none exist. */
export const strayBaselines = Effect.fn('strayBaselines')(function* ({
  ratchets,
}: RatchetsInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  if (!existsSync(join(WORKSPACE_FOLDER, BASELINE_FOLDER))) {
    return [];
  }

  const declared = new Set(ratchets.map(({ rule }) => baselinePath({ rule })));
  const files = yield* listFiles({ folder: BASELINE_FOLDER, extension: BASELINE_EXTENSION });

  return Array.difference(files, declared);
});
