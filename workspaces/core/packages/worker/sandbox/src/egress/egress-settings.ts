import { Result, Schema } from 'effect';
import { EgressVariables } from './schemas.ts';

class EgressMisconfigured extends Schema.TaggedError<EgressMisconfigured>()('EgressMisconfigured', {
  reason: Schema.String,
}) {}

type EgressSettingsInput = { readonly environment: unknown };

/** Invalid deployment settings leave the gateway closed. */
export function egressSettings({ environment }: EgressSettingsInput): EgressVariables {
  const decoded = Schema.decodeUnknownResult(EgressVariables)(environment);
  const checked = Result.mapError(decoded, () => new EgressMisconfigured({ reason: 'invalid deployment origin' }));

  return Result.getOrThrow(checked);
}
