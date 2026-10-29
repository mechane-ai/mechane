/** The version of the JSON document and the JSON Lines records a command writes. */
export const ENVELOPE_SCHEMA_VERSION = 3;

/** The kinds of JSON Lines record a command writes. */
export const RecordKind = { Result: 'result', Error: 'error' } as const;

export type RecordKind = (typeof RecordKind)[keyof typeof RecordKind];
