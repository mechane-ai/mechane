import { Dispatch, Turn } from '@mechane/protocol';
import { Schema } from 'effect';

/**
 * A turn's trace as `mechane turn show` answers it, every record of a kind this release knows. A smoke reads its own
 * deployment's trace so, where a client reads a newer deployment's records as unknown.
 */
export const KnownTrace = Schema.Struct({ turn: Turn, dispatches: Schema.Array(Dispatch) });

export type KnownTrace = typeof KnownTrace.Type;
