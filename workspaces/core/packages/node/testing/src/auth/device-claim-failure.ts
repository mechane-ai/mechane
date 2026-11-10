import { Result, Schema } from 'effect';
import type { CliResult } from '../cli/types.ts';

const FailureCode = Schema.Literals([
  'RateLimited',
  'ServiceUnavailable',
  'DeviceApprovalNotFound',
  'KeyExpired',
  'OriginUnreachable',
  'RequestTimedOut',
  'ResponseUnreadable',
]);

const FailureEnvelope = Schema.fromJsonString(
  Schema.Struct({ errors: Schema.Array(Schema.Struct({ code: Schema.Unknown })) }),
);

const FAILURE_MESSAGES: Readonly<Record<typeof FailureCode.Type, string>> = {
  RateLimited: 'authentication was rate limited',
  ServiceUnavailable: 'the authentication service was unavailable',
  DeviceApprovalNotFound: 'the approval was not available',
  KeyExpired: 'the credential expired',
  OriginUnreachable: 'no authentication server answered',
  RequestTimedOut: 'the authentication request timed out',
  ResponseUnreadable: 'the authentication response could not be decoded',
};

export function deviceClaimFailure(result: CliResult): Error {
  const decoded = Schema.decodeUnknownResult(FailureEnvelope)(result.stdout);
  const envelope = Result.getOrElse(decoded, () => ({ errors: [] }));
  const failure = envelope.errors[0];
  let code = 'NoTerminalFailure';
  let message = 'the CLI stopped without a terminal failure record';

  if (failure !== undefined) {
    code = 'UnrecognizedFailure';
    message = 'the CLI returned an unrecognized failure code';

    if (Schema.is(FailureCode)(failure.code)) {
      code = failure.code;
      message = FAILURE_MESSAGES[failure.code];
    }
  }

  return new Error(
    `The CLI could not claim the approved device key (exit ${String(result.status)}, signal ${String(result.signal)}, ${code}: ${message})`,
  );
}
