import { RELEASE, SERVICE } from '@mechane/protocol';
import type { catalog, Health } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Answers with the service name and release, without calling a Durable Object. */
export const health: (input: WorkInput<typeof catalog.health>) => Effect.Effect<Health> = () =>
  Effect.succeed({ service: SERVICE, release: RELEASE });
