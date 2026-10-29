import { Option, Redacted } from 'effect';
import type { RemoteMcpInput } from './types.ts';

type RedactRemoteJsonInput = Pick<RemoteMcpInput, 'token'> & { readonly serialized: string };

/** Removes JSON-escaped credential echoes before remote content reaches persisted model output. */
export function redactRemoteJson({ serialized, token }: RedactRemoteJsonInput): string {
  if (Option.isNone(token)) {
    return serialized;
  }

  const credential = Redacted.value(token.value);
  const encoded = JSON.stringify(credential);
  const secretText = encoded.slice(1, -1);

  return serialized.replaceAll(secretText, '[redacted]');
}
