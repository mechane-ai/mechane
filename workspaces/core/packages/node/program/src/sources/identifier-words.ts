type IdentifierWordsInput = { readonly identifier: string };

/**
 * The words of an identifier in any case style, in lowercase. `startStack`, `START_STACK` and `start-stack` all hold
 * `start` and `stack`, and `HTTPServer` holds `http` and `server`.
 */
export function identifierWords({ identifier }: IdentifierWordsInput): ReadonlyArray<string> {
  return identifier
    .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[^A-Za-z0-9]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
}
