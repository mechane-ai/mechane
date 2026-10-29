import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { mechLine } from './mech-line.ts';
import { withWorkspace } from './with-workspace.ts';

/** Prints the mech definition, lifecycle state, and saved and active revision numbers. */
export const runMechShow = Effect.fn('runMechShow')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'mech show'>): Effect.fn.Return<CommandResult<'mech show'>, RunFailure> {
  const mech = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) => call({ name: 'showMech', input: { ...input, workspaceId }, credential: token }),
  });

  return {
    lines: [
      mechLine({ mech }),
      `active revision ${mech.activeRevision}; daily cap ${mech.dailyCapMicros} micro-dollars`,
      Option.getOrElse(mech.instructions, () => 'No mission instructions.'),
    ],
    result: mech,
  };
});
