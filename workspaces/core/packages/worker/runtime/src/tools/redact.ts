import { TOOL_RESPONSE_MAX_BYTES } from './constants.ts';
import { serializedToolResult } from './serialized-result.ts';

type RedactInput = { readonly value: unknown; readonly secrets: ReadonlyArray<string>; readonly maximumBytes?: number };

export function redactToolResult({ value, secrets, maximumBytes = TOOL_RESPONSE_MAX_BYTES }: RedactInput): unknown {
  const serialized = { text: serializedToolResult(value) };
  const ordered = secrets.filter((secret) => secret.length > 0).toSorted((left, right) => right.length - left.length);

  for (const secret of ordered) {
    const encoded = JSON.stringify(secret).slice(1, -1);
    serialized.text = serialized.text.replaceAll(encoded, '[redacted]');
  }

  if (new TextEncoder().encode(serialized.text).byteLength > maximumBytes) {
    return undefined;
  }

  return JSON.parse(serialized.text);
}
