import { DefinitionRevision } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { Schema } from 'effect';

/** The identity and optimistic revision check shared by definition and lifecycle changes. */
export const CHANGE_FIELDS = {
  mechId: MechId,
  expectedRevision: Schema.NumberFromString.pipe(Schema.decodeTo(DefinitionRevision)),
} as const;
