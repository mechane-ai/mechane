import type { ProcessStart } from '@mechane/sandbox-wire';
import { Option, Record, Redacted } from 'effect';
import { createHash } from 'node:crypto';

type ProcessFingerprintInput = { readonly request: ProcessStart };

/** Only the hash survives settlement; credentials never enter an identity record as plain text. */
export function processFingerprint({ request }: ProcessFingerprintInput): string {
  const access = Option.getOrElse(request.environment, () => ({ variables: {}, secrets: {} }));
  const variables = Record.toEntries(access.variables).toSorted(([left], [right]) => left.localeCompare(right));
  const revealed = Record.map(access.secrets, Redacted.value);
  const secrets = Record.toEntries(revealed).toSorted(([left], [right]) => left.localeCompare(right));
  const value = JSON.stringify({ command: request.command, variables, secrets });
  const hash = createHash('sha256');

  hash.update(value);

  return hash.digest('hex');
}
