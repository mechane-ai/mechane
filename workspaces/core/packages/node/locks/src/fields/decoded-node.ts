import { Option, Result, Schema } from 'effect';
import type { JsonSchema } from 'effect';
import { JsonSchemaNode } from './schemas.ts';

/** The prefix of a JSON Schema document's reference to one of its definitions, before the definition's name. */
const DEFINITION_REFERENCE = '#/$defs/';

/** A node as its document holds it, which may be a reference to one of the document's definitions. */
type DecodedNodeInput = { readonly node: unknown; readonly definitions: JsonSchema.Definitions };

const decodeJsonSchemaNode = Schema.decodeUnknownResult(JsonSchemaNode);

/**
 * A node as the lock's walks read it, with a reference replaced by the definition it names. Effect wrote the document
 * from this release's own schemas, so a node that does not decode is a defect.
 */
export function decodedNode({ node, definitions }: DecodedNodeInput): JsonSchemaNode {
  let decoded = decodeNode({ node });

  while (Option.isSome(decoded.$ref)) {
    const definition = decoded.$ref.value.replace(DEFINITION_REFERENCE, '');

    decoded = decodeNode({ node: definitions[definition] });
  }

  return decoded;
}

type DecodeNodeInput = { readonly node: unknown };

function decodeNode({ node }: DecodeNodeInput): JsonSchemaNode {
  const result = decodeJsonSchemaNode(node);

  return Result.getOrThrow(result);
}
