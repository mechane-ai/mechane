import { Schema } from 'effect';
import { readFailureCode } from '../cli/read-failure-code.ts';
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
  const code = readFailureCode(result.stdout);
  let message = 'the CLI returned an unexpected failure code';

  if (code === 'NoTerminalFailure') {
    message = 'the CLI stopped without a terminal failure record';
  } else if (Schema.is(FailureCode)(code)) {
    message = FAILURE_MESSAGES[code];
  }

  return new Error(
    `The CLI could not claim the approved device key (exit ${String(result.status)}, signal ${String(result.signal)}, ${code}: ${message})`,
  );
}
