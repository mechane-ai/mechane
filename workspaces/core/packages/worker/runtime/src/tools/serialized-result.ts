export function serializedToolResult(value: unknown): string {
  const text: unknown = JSON.stringify(value);

  if (typeof text !== 'string') {
    throw new TypeError('The tool result could not be serialized as JSON');
  }

  return text;
}
