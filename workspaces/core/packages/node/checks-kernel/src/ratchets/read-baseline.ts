import { Effect, Option } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSPACE_FOLDER } from '../constants.ts';
import { decodeFile } from '../decode-file.ts';
import type { InputUnreadable } from '../errors.ts';
import { Baseline } from '../schemas.ts';
import { baselinePath } from './baseline-path.ts';
import type { RuleInput } from './types.ts';

/** A ratchet's baseline, or none before `mise run fix` writes its first one. */
export const readBaseline = Effect.fn('readBaseline')(function* ({
  rule,
}: RuleInput): Effect.fn.Return<Option.Option<Baseline>, InputUnreadable> {
  const path = baselinePath({ rule });

  if (!existsSync(join(WORKSPACE_FOLDER, path))) {
    return Option.none();
  }

  return Option.some(yield* decodeFile({ path, schema: Baseline }));
});
