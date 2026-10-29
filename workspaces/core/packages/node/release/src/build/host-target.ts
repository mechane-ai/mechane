import { CliTarget } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { ReleaseStep } from '../constants.ts';
import { ReleaseFailed } from '../errors.ts';

/** The target of this machine, for which a local release compiles only the binary it runs, as a release names it. */
export const hostTarget = Effect.fn('hostTarget')(function* (): Effect.fn.Return<CliTarget, ReleaseFailed> {
  const target = `${process.platform}-${process.arch}`;
  const reason = `no release targets ${target}`;

  return yield* Schema.decodeUnknownEffect(Schema.Enum(CliTarget))(target).pipe(
    Effect.mapError(() => new ReleaseFailed({ step: ReleaseStep.FindHostTarget, reason })),
  );
});
