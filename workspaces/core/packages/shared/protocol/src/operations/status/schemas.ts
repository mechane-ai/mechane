import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { Release } from '../../releases/schemas.ts';
import { Revision } from '../../schemas.ts';
import { SERVICE } from './constants.ts';

/** Health identifies the service and the immutable release it serves. */
export const Health = Schema.Struct({ service: Schema.Literal(SERVICE), release: Release });

export type Health = typeof Health.Type;

/** Readiness confirms the running release and the applied product database schema. */
export const Readiness = wireStruct({
  fields: { release: Release, runtimeRevision: Revision, storageRevision: Schema.Int },
});

export type Readiness = typeof Readiness.Type;
