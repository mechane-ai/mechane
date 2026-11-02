import { LoopbackOrigin } from '@mechane/deployment';
import { ReleaseDescriptor } from '@mechane/program';
import { Schema } from 'effect';
import { LOCAL_APPLICATION } from './constants.ts';

/** Identifies a local installation and the origin its credentials remain bound to. */
export const LocalState = Schema.Struct({
  application: Schema.Literal(LOCAL_APPLICATION),
  origin: LoopbackOrigin,
  release: ReleaseDescriptor,
});

export type LocalState = typeof LocalState.Type;

/** Old launchers recognize only this marker and cannot open an installation after adoption. */
const UNVERSIONED_LOCAL_APPLICATION = 'mechane';

const UnversionedLocalState = Schema.Struct({
  application: Schema.Literal(UNVERSIONED_LOCAL_APPLICATION),
  origin: LoopbackOrigin,
});

/** Reset recognizes both generations without needing to run or adopt either one. */
export const RecognizedLocalStateJson = Schema.fromJsonString(Schema.Union([LocalState, UnversionedLocalState]));

export type RecognizedLocalStateJson = typeof RecognizedLocalStateJson.Type;
