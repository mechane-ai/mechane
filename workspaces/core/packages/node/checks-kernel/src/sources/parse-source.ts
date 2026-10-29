import type { ParsedSource } from '@mechane/modules';
import { Effect } from 'effect';
import type { InputUnreadable } from '../errors.ts';
import { readText } from '../read-text.ts';
import type { ReadInput } from '../types.ts';
import { parsedText } from './parsed-text.ts';

/** Reads one TypeScript file and parses it once, for every owned rule that reads its syntax. */
export const parseSource = Effect.fn('parseSource')(function* ({
  path,
}: ReadInput): Effect.fn.Return<ParsedSource, InputUnreadable> {
  return parsedText({ path, text: yield* readText({ path }) });
});
