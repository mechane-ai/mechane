import { callObject, readinessStubs } from '@mechane/bindings';
import { RELEASE } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, Readiness } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** The object of one Durable Object class that readiness opens, and the call that asks its schema revision. */
type ClassRevisionInput = ReturnType<typeof readinessStubs>[number];

/** One Durable Object class and the schema revision its database reports. */
type ClassRevision = Readiness['durableObjects'][number];

/**
 * Reports the release, the worker revision and the schema revision of every Durable Object class, from one object of
 * each that readiness opens, which proves each class opens and migrates.
 */
export const readiness = Effect.fn('readiness')(function* ({
  settings,
}: WorkInput<typeof catalog.readiness>): Effect.fn.Return<Readiness, ObjectUnavailable> {
  const durableObjects = yield* Effect.forEach(readinessStubs({ bindings: settings }), classRevision, {
    concurrency: 1,
  });

  return { release: RELEASE, workerRevision: settings.workerRevision, durableObjects };
});

/** The schema revision the class's object reports, which opening it migrated to. */
const classRevision = Effect.fn('classRevision')(function* ({
  objectClass,
  schemaRevision,
}: ClassRevisionInput): Effect.fn.Return<ClassRevision, ObjectUnavailable> {
  const revision = yield* callObject({ objectClass, call: schemaRevision, answer: Schema.Int });

  return { objectClass, schemaRevision: revision };
});
