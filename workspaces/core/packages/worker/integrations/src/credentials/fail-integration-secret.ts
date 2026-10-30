import { Result } from 'effect';
import { IntegrationSecretInvalid } from './errors.ts';

/** Provider exceptions and malformed stored envelopes share one value-free failure. */
export function failIntegrationSecret(): Result.Result<never, IntegrationSecretInvalid> {
  const failure = new IntegrationSecretInvalid();

  return Result.fail(failure);
}
