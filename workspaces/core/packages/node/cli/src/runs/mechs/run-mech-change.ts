import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { CommandInput } from '@mechane/commands';
import type { catalog } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { mechLine } from './mech-line.ts';
import { withWorkspace } from './with-workspace.ts';

type ChangeCommand = 'mech update' | 'mech rename' | 'mech pause' | 'mech resume' | 'mech archive';

type RunMechChangeInput<N extends ChangeCommand> = Omit<RunInput<N>, 'input'> & {
  readonly input: CommandInput<'mech update'>;
};

type DefinitionChangeInput = { readonly input: CommandInput<'mech update'> };

/** Saves a definition change with the caller's expected revision and prints the resulting state. */
export const runMechChange = Effect.fn('runMechChange')(function* <N extends ChangeCommand>({
  call,
  origin,
  input,
  credentials,
}: RunMechChangeInput<N>): Effect.fn.Return<CommandResult<N>, RunFailure> {
  const change = definitionChange({ input });

  const mech = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) =>
      call({ name: 'updateMech', input: { ...change, workspaceId, mechId: input.mechId }, credential: token }),
  });

  return { lines: [mechLine({ mech })], result: mech };
});

function definitionChange({ input }: DefinitionChangeInput): typeof catalog.updateMech.body.Type {
  const { instructions, ...change } = input;
  const mission = Option.fromUndefinedOr(instructions);

  const withInstructions: (text: string) => typeof catalog.updateMech.body.Type = (text) => {
    const present = Option.some(text);
    const changedInstructions = Option.filter(present, (value) => value !== '');

    return { ...change, instructions: changedInstructions };
  };

  return Option.match(mission, { onNone: () => change, onSome: withInstructions });
}
