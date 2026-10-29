import { FlagsInvalid, UsageInvalid } from '@mechane/cli-kernel';
import type { OutputMode } from '@mechane/commands';
import { WorkspaceId } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';

type DecodeWorkspaceInput = {
  /** None when neither the flag nor its environment variable selects a workspace. */
  readonly text: Option.Option<string>;
  readonly output: OutputMode;
};

/** An omitted selector preserves the personal default; a malformed UUID is a usage error. */
export const decodeWorkspace = Effect.fn('decodeWorkspace')(function* ({
  text,
  output,
}: DecodeWorkspaceInput): Effect.fn.Return<Option.Option<WorkspaceId>, UsageInvalid> {
  if (Option.isNone(text)) {
    return Option.none();
  }

  const invalid: (error: Schema.SchemaError) => UsageInvalid = (error) => {
    const problem = new FlagsInvalid({ reason: `workspace ${text.value}: ${error.message}` });

    return new UsageInvalid({ problem, output });
  };

  const workspaceId = yield* Schema.decodeUnknownEffect(WorkspaceId)(text.value).pipe(Effect.mapError(invalid));

  return Option.some(workspaceId);
});
