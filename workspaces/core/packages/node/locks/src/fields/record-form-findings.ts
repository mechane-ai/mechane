import type { Finding } from '@mechane/checks-kernel';
import { catalog, ServerFailure } from '@mechane/protocol';
import type { Operation } from '@mechane/protocol';
import { RandomId, wireKey } from '@mechane/records';
import { Option, Record, Schema } from 'effect';
import type { JsonSchema } from 'effect';
import { TAG_FIELD } from '../constants.ts';
import { decodedNode } from './decoded-node.ts';
import { isRequestForm } from './is-request-form.ts';
import type { JsonSchemaNode } from './schemas.ts';

/** The protocol's source, which declares every schema an answer of `/v1` is decoded with. */
const PROTOCOL_SOURCE = 'packages/shared/protocol/src';

/** A node as its document holds it, the document's definitions, and the path a finding names it by. */
type NodePathsInput = { readonly node: unknown; readonly definitions: JsonSchema.Definitions; readonly path: string };

/** A decoded node and its path, such as `GET /v1/keys output.keys[].name`. */
type NodePath = { readonly node: JsonSchemaNode; readonly path: string };

/** An object's property, by its key. */
type PropertyEntry = readonly [key: string, property: unknown];

/**
 * Each field of an operation's output or of an error that keeps a request's limit. Such a text is bounded below a
 * record's, or such an id must be a version 4 UUID, which only a caller-made id's request asks. A client decodes every
 * answer, so the limit would bind every installed CLI, and a later deployment could not raise it.
 */
export function recordFormFindings(): ReadonlyArray<Finding> {
  const requestIdPattern = decodedNode({ node: Schema.toJsonSchemaDocument(RandomId).schema, definitions: {} }).pattern;

  /** Each node under an operation's output. */
  const outputPaths: (operation: Operation) => ReadonlyArray<NodePath> = (operation) => {
    const { schema, definitions } = Schema.toJsonSchemaDocument(operation.output);

    return nodePaths({ node: schema, definitions, path: `${operation.method} ${operation.path} output` });
  };

  /** Each node under an error's fields, by the error's code and the field's wire key. */
  const errorFieldPaths: (failure: (typeof ServerFailure.members)[number]) => ReadonlyArray<NodePath> = (failure) => {
    const { schema, definitions } = Schema.toJsonSchemaDocument(failure);

    const fieldPaths: (property: PropertyEntry) => ReadonlyArray<NodePath> = ([field, node]) =>
      nodePaths({ node, definitions, path: `${failure.identifier}.${wireKey({ field })}` });

    return Record.toEntries(decodedNode({ node: schema, definitions }).properties)
      .filter(([field]) => field !== TAG_FIELD)
      .flatMap(fieldPaths);
  };

  const asksRequestForm: (nodePath: NodePath) => boolean = ({ node }) =>
    [node, ...node.allOf].some((form) => isRequestForm({ form, requestIdPattern }));

  const recordFormFinding: (nodePath: NodePath) => Finding = ({ path }) => ({
    check: 'record-forms',
    location: PROTOCOL_SOURCE,
    message: `Read ${path} through its record form, such as \`RecordText\` for \`InboxText\` or \`RecordId\` for \`RandomId\`, since a request's limit in an answer binds every installed CLI`,
  });

  const paths = [...Record.values(catalog).flatMap(outputPaths), ...ServerFailure.members.flatMap(errorFieldPaths)];

  return paths.filter(asksRequestForm).map(recordFormFinding);
}

/** Each node at and under a node, by its path: a union's branches at its own, an array's items and each property. */
function nodePaths({ node, definitions, path }: NodePathsInput): ReadonlyArray<NodePath> {
  const decoded = decodedNode({ node, definitions });

  const itemPaths: (items: unknown) => ReadonlyArray<NodePath> = (items) =>
    nodePaths({ node: items, definitions, path: `${path}[]` });

  const propertyPaths: (property: PropertyEntry) => ReadonlyArray<NodePath> = ([key, property]) =>
    nodePaths({ node: property, definitions, path: `${path}.${key}` });

  return [
    { node: decoded, path },
    ...decoded.anyOf.flatMap((branch) => nodePaths({ node: branch, definitions, path })),
    ...Option.toArray(decoded.items).flatMap(itemPaths),
    ...Record.toEntries(decoded.properties).flatMap(propertyPaths),
  ];
}
