import { memberOrUnknown, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { DurableObjectClass } from '../../durable-objects/constants.ts';
import { Release } from '../../releases/schemas.ts';
import { Revision } from '../../schemas.ts';
import { SERVICE } from './constants.ts';

/** What the health probe answers: Mechane's name, so a caller tells it from another server, and its release. */
export const Health = Schema.Struct({ service: Schema.Literal(SERVICE), release: Release });

export type Health = typeof Health.Type;

/** How many schema migrations one Durable Object's database has applied. */
const ObjectRevision = wireStruct({
  fields: { objectClass: memberOrUnknown({ set: DurableObjectClass }), schemaRevision: Schema.Int },
});

/** What a deployment runs: its release, its worker revision, and each Durable Object's schema revision. */
export const Readiness = wireStruct({
  fields: { release: Release, workerRevision: Revision, durableObjects: Schema.Array(ObjectRevision) },
});

export type Readiness = typeof Readiness.Type;
