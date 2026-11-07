import { Schema } from 'effect';

/** A declared media operation returns its authenticated stream without JSON encoding. */
export const MediaResponse = Schema.instanceOf(Response);
export type MediaResponse = typeof MediaResponse.Type;

/** Marks an operation whose declared success body is an authenticated media stream. */
export const ResponseKind = { Media: 'media' } as const;
