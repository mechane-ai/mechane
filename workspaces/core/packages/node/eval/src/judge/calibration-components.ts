import { Schema } from 'effect';
import { EvalId } from '../schemas.ts';

/** Calibration keeps private labels and their exact evidence identity in the saved definition. */
export const CalibrationComponents = Schema.Struct({
  suite: Schema.Json,
  calibration: Schema.Array(Schema.Struct({ id: EvalId, evidenceDigest: Schema.String, expected: Schema.Json })),
});

export type CalibrationComponents = typeof CalibrationComponents.Type;
