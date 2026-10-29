import { DeployFailed, DeployStep, PROGRAM } from '@mechane/deploy-kernel';
import { lostEntries, StepSubject, writeDiagnostic } from '@mechane/program';
import { Effect, Option } from 'effect';
import { readFormats } from './read-formats.ts';
import type { AppendOnlyInput, RevisionInput } from './types.ts';

/**
 * Checks that this tree only appends to the formats the deployed tag ships. It answers with the tags of the Wrangler
 * migrations this deploy adds, every one of them on a first deploy.
 */
export function checkAppendOnly({
  settings,
  deployed,
  rendered,
}: AppendOnlyInput): Effect.Effect<ReadonlyArray<string>, DeployFailed> {
  return Option.match(deployed, {
    onNone: () => {
      writeDiagnostic({ program: PROGRAM, line: 'append-only: nothing is deployed, so every migration is new' });

      return Effect.succeed(rendered.migrations.map((migration) => migration.tag));
    },
    onSome: ({ tag }) => appendedMigrations({ revision: tag, settings }),
  });
}

/**
 * The tags of the Wrangler migrations `HEAD` adds to the deployed revision's, once every entry of that revision's wire
 * lock and migration lock stays in `HEAD`'s. The check of `HEAD` holds its locks to its source, so no shipped name and
 * no schema step is renamed, edited, moved or removed. The lock holds each Wrangler migration at its position, so the
 * deployed ones are the first of `HEAD`'s.
 */
function appendedMigrations({ revision, settings }: RevisionInput): Effect.Effect<ReadonlyArray<string>, DeployFailed> {
  return Effect.gen(function* () {
    const before = yield* readFormats({ revision, settings });
    const after = yield* readFormats({ revision: 'HEAD', settings });

    const lost = [
      ...lostEntries({ locked: before.wireLock, current: after.wireLock }),
      ...lostEntries({ locked: before.migrationLock, current: after.migrationLock }),
    ];

    if (lost.length > 0) {
      return yield* new DeployFailed({
        step: DeployStep.CompareLocks,
        subjects: [StepSubject.cases.Revision.make({ revision })],
        reason: `HEAD's locks lack ${lost.map(({ key, entry }) => `${key} ${entry}`).join('; ')}`,
      });
    }

    writeDiagnostic({ program: PROGRAM, line: `append-only: HEAD's locks hold every entry ${revision}'s do` });

    return after.migrations.slice(before.migrations.length).map((migration) => migration.tag);
  });
}
