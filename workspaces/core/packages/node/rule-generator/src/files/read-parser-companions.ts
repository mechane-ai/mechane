import { PARSER_COMPANIONS, parserCompanion } from '@mechane/rules';
import type { GeneratedFile, ParserCompanion } from '@mechane/rules';
import { Effect } from 'effect';
import type { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

type ReadCompanionInput = { readonly companion: ParserCompanion };

/** Reads each owned matcher and renders its other parser's rule from the same source. */
export const readParserCompanions = Effect.fn('readParserCompanions')(function* (): Effect.fn.Return<
  ReadonlyArray<GeneratedFile>,
  GenerateFailed
> {
  return yield* Effect.forEach(PARSER_COMPANIONS, (companion) => readCompanion({ companion }), { concurrency: 1 });
});

const readCompanion = Effect.fn('readCompanion')(function* ({
  companion,
}: ReadCompanionInput): Effect.fn.Return<GeneratedFile, GenerateFailed> {
  const text = yield* readInput({ path: companion.source });

  return parserCompanion({ companion, text });
});
