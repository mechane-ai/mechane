import { Array, Effect, Option } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

type VariableLineInput = { readonly name: string; readonly value: string };

/** celld strips the outer quote pair literally and closes multiline values at the first matching line ending. */
export const variableLine = Effect.fn('variableLine')(function* ({
  name,
  value,
}: VariableLineInput): Effect.fn.Return<string, StackFailed> {
  const interiorLines = value.split('\n').slice(0, -1);
  const lastCharacter: (line: string) => string = (line) => line.trimEnd().slice(-1);
  const lastCharacters = interiorLines.map(lastCharacter);
  const endings = new Set(lastCharacters);
  const isAvailable: (candidate: string) => boolean = (candidate) => !endings.has(candidate);
  const quote = Array.findFirst(['"', "'"], isAvailable);

  if (Option.isNone(quote) || value.includes('\r')) {
    return yield* new StackFailed({
      step: StackStep.WriteVariables,
      reason: `${name} cannot be represented in celld's dotenv format; use single-line JSON for structured values`,
    });
  }

  return `${name}=${quote.value}${value}${quote.value}\n`;
});
