import { DeployFailed, DeployStep, runGit } from '@mechane/deploy-kernel';
import { Lock, MIGRATION_LOCK, StepSubject, WIRE_LOCK } from '@mechane/program';
import { decodeJsonc, WranglerMigrations } from '@mechane/wrangler';
import { Effect } from 'effect';
import type { Schema } from 'effect';
import { FormatPath } from './constants.ts';
import type { DecodedAtInput, ReleaseFormats, RevisionInput } from './types.ts';

/**
 * The stored and shipped formats a revision of the product declares, read with git so that no store is imported. They
 * are its Wrangler migrations, its wire lock and its migration lock, which its own check held to its source.
 */
export function readFormats({ revision, settings }: RevisionInput): Effect.Effect<ReleaseFormats, DeployFailed> {
  return Effect.gen(function* () {
    const { migrations } = yield* decodedAt({
      revision,
      path: FormatPath.WranglerConfiguration,
      schema: WranglerMigrations,
      settings,
    });

    return {
      migrations,
      wireLock: yield* decodedAt({ revision, path: WIRE_LOCK, schema: Lock, settings }),
      migrationLock: yield* decodedAt({ revision, path: MIGRATION_LOCK, schema: Lock, settings }),
    };
  });
}

/** A file of JSON as the revision commits it, decoded with the schema. */
function decodedAt<S extends Schema.Codec<unknown, unknown>>({
  revision,
  path,
  schema,
  settings,
}: DecodedAtInput<S>): Effect.Effect<S['Type'], DeployFailed> {
  const subjects = [StepSubject.cases.Path.make({ path }), StepSubject.cases.Revision.make({ revision })];

  return runGit({ args: ['show', `${revision}:./${path}`], settings }).pipe(
    Effect.flatMap((text) =>
      decodeJsonc({ text, schema, options: {}, step: DeployStep.ReadFormats, subjects, failure: DeployFailed }),
    ),
  );
}
