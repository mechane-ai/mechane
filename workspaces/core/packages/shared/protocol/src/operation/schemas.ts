import { HttpMethod } from '@mechane/records';
import { Schema, SchemaTransformation } from 'effect';

/** A field that no schema declares; it fails with the message a declared struct gives an excess property. */
const UndeclaredField = Schema.Never.annotate({ message: 'Expected no excess property' });

/**
 * The schema of a request part that carries no fields, such as the body of a `GET` operation. It refuses every field on
 * decode and encodes none, as a declared struct does, which an empty `Schema.Struct` would pass through both ways.
 */
export const NoFields = Schema.Record(Schema.String, UndeclaredField).pipe(
  Schema.decodeTo(Schema.Struct({}), SchemaTransformation.transform({ decode: () => ({}), encode: () => ({}) })),
);

export type NoFields = typeof NoFields.Type;

/** The HTTP methods an operation may declare; a `POST` operation carries its body as JSON. */
export const OperationMethod = Schema.Literals([HttpMethod.Get, HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete]);

export type OperationMethod = typeof OperationMethod.Type;
