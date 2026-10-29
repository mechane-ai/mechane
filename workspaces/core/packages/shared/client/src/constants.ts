import { RELEASE_FAILURES, ROUTE_FAILURES } from '@mechane/protocol';

/** Which read of an answer failed: its body as JSON, or the parsed body by the schemas its request expects. */
export const AnswerStep = { ParseJson: 'parse_json', Decode: 'decode' } as const;

export type AnswerStep = (typeof AnswerStep)[keyof typeof AnswerStep];

/** The failures a read of a release file expects: the release's own, and those of every route. */
export const RELEASE_READ_FAILURES = [...RELEASE_FAILURES, ...ROUTE_FAILURES] as const;
