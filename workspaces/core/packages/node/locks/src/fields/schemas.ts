import { Effect, Schema } from 'effect';

/** The limits a text's form may set, which a node or a schema it joins carries. */
const TEXT_LIMIT_FIELDS = {
  /** Absent unless the form bounds the text's length, in UTF-16 code units. */
  maxLength: Schema.OptionFromOptionalKey(Schema.Int),
  /** Absent unless the text must match a pattern, such as an id's. */
  pattern: Schema.OptionFromOptionalKey(Schema.String),
} as const;

/**
 * A node of the JSON Schema document Effect writes for an operation's part, as the field lock reads it. It holds a
 * reference to a definition, a union's branches, an enum's values, an array's items and an object's properties. A
 * variant that reads a newer deployment's records also keeps the wire's rest, and a text may carry the limits of its
 * form.
 */
export const JsonSchemaNode = Schema.Struct({
  /** Absent unless a definition of the document stands in the node's place. */
  $ref: Schema.OptionFromOptionalKey(Schema.String),
  /** Absent, and so empty, unless the node is a union, such as a nullable value or a closed set read tolerantly. */
  anyOf: Schema.Array(Schema.Unknown).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  /** Absent, and so empty, unless the node is a literal or a closed set. */
  enum: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  /** Absent for a union or a reference, which has no type of its own. */
  type: Schema.OptionFromOptionalKey(Schema.String),
  /** Absent unless the node is an array. */
  items: Schema.OptionFromOptionalKey(Schema.Unknown),
  /** Absent, and so empty, unless the node is an object. */
  properties: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.withDecodingDefaultKey(Effect.succeed({}))),
  ...TEXT_LIMIT_FIELDS,
  /** Absent, and so empty, unless the node joins more schemas, as a second pattern or a kept rest does. */
  allOf: Schema.Array(
    Schema.Struct({
      /** Absent unless the joined schema holds the wire's rest beside an object's properties. */
      additionalProperties: Schema.OptionFromOptionalKey(Schema.Unknown),
      ...TEXT_LIMIT_FIELDS,
    }),
  ).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

/** A JSON Schema node, decoded with the keywords the field lock reads. */
export type JsonSchemaNode = typeof JsonSchemaNode.Type;
