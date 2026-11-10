import { Schema } from 'effect';

/** Missing requests can be resubmitted only when the host retained their original submission. */
export const ExternalRequestRecovery = { Retry: 'retry', Missing: 'missing', Stop: 'stop' } as const;

export type ExternalRequestRecovery = (typeof ExternalRequestRecovery)[keyof typeof ExternalRequestRecovery];

/** Only sanitized diagnostics cross the request transport and host-tool boundary. */
export class ExternalRequestUnavailable extends Schema.TaggedError<ExternalRequestUnavailable>()(
  'ExternalRequestUnavailable',
  { recovery: Schema.Enum(ExternalRequestRecovery), reason: Schema.String },
) {}
