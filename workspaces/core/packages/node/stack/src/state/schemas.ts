import { LoopbackOrigin } from '@mechane/deployment';
import { Schema } from 'effect';
import { LOCAL_APPLICATION } from './constants.ts';

/** Identifies a local installation and the origin its credentials remain bound to. */
export const LocalState = Schema.Struct({ application: Schema.Literal(LOCAL_APPLICATION), origin: LoopbackOrigin });
export type LocalState = typeof LocalState.Type;

/** The local installation manifest as its on-disk JSON text. */
export const LocalStateJson = Schema.fromJsonString(LocalState);
export type LocalStateJson = typeof LocalStateJson.Type;
