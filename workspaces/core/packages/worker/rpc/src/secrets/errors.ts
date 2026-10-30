import { Schema } from 'effect';
import { OperatorSecretName } from './constants.ts';

/** Binding failures can contain provider diagnostics, so only the binding name crosses this boundary. */
export class OperatorSecretUnavailable extends Schema.TaggedError<OperatorSecretUnavailable>()(
  'OperatorSecretUnavailable',
  { binding: Schema.Enum(OperatorSecretName) },
) {}
