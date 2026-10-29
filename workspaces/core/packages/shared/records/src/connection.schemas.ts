import { Schema } from 'effect';
import { RecordId } from './schemas.ts';

/** A reusable endpoint identifier remains distinct from mech and workspace identities. */
export const ConnectionId = RecordId.pipe(Schema.brand('ConnectionId'));
export type ConnectionId = typeof ConnectionId.Type;
