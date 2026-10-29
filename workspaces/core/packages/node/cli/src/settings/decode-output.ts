import { OutputModeRefused, UsageInvalid } from '@mechane/cli-kernel';
import { CommandShape, OutputMode } from '@mechane/commands';
import { Effect, Option, Schema } from 'effect';
import { defaultOutput } from './default-output.ts';

/** The output modes each shape of command writes; one document cannot hold a stream that may never end. */
const SHAPE_OUTPUTS = {
  [CommandShape.Document]: [OutputMode.Human, OutputMode.Json, OutputMode.Jsonl],
  [CommandShape.Stream]: [OutputMode.Human, OutputMode.Jsonl],
} as const;

type DecodeOutputInput = {
  /** None when neither the flag nor its variable names a mode. */
  readonly text: Option.Option<string>;
  readonly isTerminal: boolean;
  readonly shape: CommandShape;
};

/** The output mode the flag or its variable names, one the command's shape writes, or the default for where it goes. */
export const decodeOutput = Effect.fn('decodeOutput')(function* ({
  text,
  isTerminal,
  shape,
}: DecodeOutputInput): Effect.fn.Return<OutputMode, UsageInvalid> {
  const fallback = defaultOutput({ isTerminal, shape });

  if (Option.isNone(text)) {
    return fallback;
  }

  const modes = SHAPE_OUTPUTS[shape];

  const refused: () => UsageInvalid = () =>
    new UsageInvalid({ problem: new OutputModeRefused({ mode: text.value, modes }), output: fallback });

  return yield* Schema.decodeUnknownEffect(Schema.Literals(modes))(text.value).pipe(Effect.mapError(refused));
});
