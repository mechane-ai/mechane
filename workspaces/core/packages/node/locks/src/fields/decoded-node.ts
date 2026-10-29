import { Option, Schema } from 'effect';
import type { JsonSchema } from 'effect';
import { JsonSchemaNode } from './schemas.ts';

/** The prefix of a JSON Schema document's reference to one of its definitions, before the definition's name. */
const DEFINITION_REFERENCE = '#/$defs/';

/** A node as its document holds it, which may be a reference to one of the document's definitions. */
type DecodedNodeInput = { readonly node: unknown; readonly definitions: JsonSchema.Definitions };

/**
 * A node as the lock's walks read it, with a reference replaced by the definition it names. Effect wrote the document
 * from this release's own schemas, so a node that does not decode is a defect.
 */
export function decodedNode({ node, definitions }: DecodedNodeInput): JsonSchemaNode {
  const decoded = Schema.decodeUnknownSync(JsonSchemaNode)(node);

  if (Option.isNone(decoded.$ref)) {
    return decoded;
  }

  const definition = decoded.$ref.value.replace(DEFINITION_REFERENCE, '');

  return decodedNode({ node: definitions[definition], definitions });
}
