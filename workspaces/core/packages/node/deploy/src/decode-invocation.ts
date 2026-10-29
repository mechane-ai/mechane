import { DeployFailed, DeployMode, DeployStep, Invocation } from '@mechane/deploy-kernel';
import { StepSubject } from '@mechane/program';
import { Effect, Record, Schema } from 'effect';
import { parseArgs } from 'node:util';

const CONFIGURATION_FLAG = 'config';
const ARGUMENT_OPTIONS = { to: { type: 'string' }, [CONFIGURATION_FLAG]: { type: 'string' } } as const;
const Mode = Schema.Enum(DeployMode);
type DecodeInvocationInput = { readonly args: ReadonlyArray<string> };

/** Refuses unknown flags and rollback targets on any other mode. */
export const decodeInvocation = Effect.fn('decodeInvocation')(function* ({
  args,
}: DecodeInvocationInput): Effect.fn.Return<Invocation, DeployFailed> {
  const step = DeployStep.ReadCommandLine;
  const subjects = [StepSubject.cases.Command.make({ args })];

  const { values, positionals } = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: ARGUMENT_OPTIONS, allowPositionals: true }),
    catch: (cause) => new DeployFailed({ step, subjects, reason: String(cause) }),
  });

  const modeReason = `name one of ${Record.values(DeployMode).join(', ')}`;
  const positionalsText = positionals.join(' ');

  const mode = yield* Schema.decodeUnknownEffect(Mode)(positionalsText).pipe(
    Effect.mapError(() => new DeployFailed({ step, subjects, reason: modeReason })),
  );

  const decoded = Schema.decodeUnknownEffect(Invocation, { onExcessProperty: 'error' })({ mode, ...values });

  const flagsInvalid: (error: Schema.SchemaError) => DeployFailed = (error) =>
    new DeployFailed({ step, subjects, reason: `the ${mode} mode's flags: ${error.message}` });

  return yield* decoded.pipe(Effect.mapError(flagsInvalid));
});
