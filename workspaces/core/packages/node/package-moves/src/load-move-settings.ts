import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Option, Record, Schema } from 'effect';
import { MoveRefused } from './errors.ts';

/** The variables the program's children inherit: git and pnpm are found on `PATH`, and read the home folder. */
const INHERITED_VARIABLES = ['PATH', 'HOME'] as const;

/** The command line: the name of the step to apply through. */
const MoveArguments = Schema.Tuple([Schema.NonEmptyString]);

/** What the command line and the environment give the move program. */
type MoveSettings = {
  /** The step of the move map to apply through, each earlier one applied first. */
  readonly step: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** Reads the command line and the environment once for the move program; no other module of it reads either. */
export const loadMoveSettings = Effect.fn('loadMoveSettings')(function* (): Effect.fn.Return<
  MoveSettings,
  MoveRefused
> {
  const names = process.argv.slice(PROGRAM_ARGUMENTS_START);
  const command = names.join(' ');

  const [step] = yield* Schema.decodeUnknownEffect(MoveArguments)(names).pipe(
    Effect.mapError(() => new MoveRefused({ path: command, reason: 'name one step of the move map, such as `store`' })),
  );

  /** A variable's name and its value, none where the environment lacks it. */
  const variable: (name: string) => readonly [string, Option.Option<string>] = (name) => [
    name,
    Option.fromNullishOr(process.env[name]),
  ];

  const variables = Record.fromIterableWith(INHERITED_VARIABLES, variable);

  return { step, inherited: Record.getSomes(variables) };
});
