import { DeployFailed, DeployStep, PROGRAM } from '@mechane/deploy-kernel';
import { StepSubject, writeDiagnostic } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { createInterface } from 'node:readline';
import type { ConfirmTagInput } from './types.ts';

/**
 * Asks the operator to type the tag a deploy or a rollback puts into production, and goes on only when the typed line
 * is that tag. Standard input that is not a terminal is refused, so no script and no `--yes` confirms for a person.
 */
export function confirmTag({ settings, tag, action }: ConfirmTagInput): Effect.Effect<void, DeployFailed> {
  const step = DeployStep.ConfirmTag;
  const subjects = [StepSubject.cases.Tag.make({ tag })];

  if (!settings.isInteractive) {
    return Effect.fail(new DeployFailed({ step, subjects, reason: 'standard input is not a terminal; run it in one' }));
  }

  writeDiagnostic({ program: PROGRAM, line: `type ${tag} to ${action} it` });

  return Effect.acquireUseRelease(
    Effect.sync(() => createInterface({ input: process.stdin })),
    (lines) =>
      Effect.tryPromise({
        try: () => lines[Symbol.asyncIterator]().next(),
        catch: (cause) => new DeployFailed({ step, subjects, reason: String(cause) }),
      }),
    (lines) => Effect.sync(() => lines.close()),
  ).pipe(
    Effect.flatMap(({ value }) => Schema.decodeUnknownEffect(Schema.String)(value)),
    Effect.mapError(() => new DeployFailed({ step, subjects, reason: 'standard input ended before a line' })),
    Effect.filterOrFail(
      (typed) => typed.trim() === tag,
      () => new DeployFailed({ step, subjects, reason: 'the typed line is not the tag; nothing changed' }),
    ),
    Effect.asVoid,
  );
}
