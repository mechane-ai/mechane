import { WireKind } from '@mechane/program';
import { catalog, ErrorBody } from '@mechane/protocol';
import type { Operation } from '@mechane/protocol';
import { Option, Predicate, Record, Schema } from 'effect';
import type { JsonSchema } from 'effect';
import { decodedNode } from './decoded-node.ts';
import type { JsonSchemaNode } from './schemas.ts';

/** One entry of a field or a member, under the kind of the wire lock that holds it. */
type FieldEntry = { readonly kind: typeof WireKind.Fields | typeof WireKind.Members; readonly entry: string };

/** The parts of an operation whose fields the wire lock holds; its path parameters are its locked path's own. */
const WIRE_PARTS = ['query', 'body', 'output'] as const;

/** Where the wire lock names the fields of the body every error response shares, beside each operation's parts. */
const ERROR_BODY_PATH = 'errors body';

/** The JSON Schema type of an object, whose properties a union's variant holds. */
const OBJECT_TYPE = 'object';

/** The wire lock's entries of the operations' parts and the error body: each field, and each member under its field. */
type FieldNames = { readonly fields: ReadonlyArray<string>; readonly members: ReadonlyArray<string> };

/** A schema whose fields the wire lock holds, and the entry it stands at, such as `GET /v1/keys output`. */
type WirePart = { readonly schema: Schema.Constraint; readonly path: string };

/** An object's property, by its key. */
type PropertyEntry = readonly [key: string, property: unknown];

/** A property that holds one value, which names a union's variant. */
type Discriminator = { readonly key: string; readonly value: string };

/** A decoded node, its document's definitions, and the entry it stands at, such as `GET /v1/keys output.keys[]`. */
type NodeNamesInput = {
  readonly node: JsonSchemaNode;
  readonly definitions: JsonSchema.Definitions;
  readonly path: string;
};

type UnionNamesInput = {
  readonly branches: ReadonlyArray<JsonSchemaNode>;
  readonly definitions: JsonSchema.Definitions;
  readonly path: string;
};

type ObjectNamesInput = {
  readonly objects: ReadonlyArray<JsonSchemaNode>;
  readonly definitions: JsonSchema.Definitions;
  readonly path: string;
};

/** An object's node at its path, and the properties that name its variant, which it does not list as fields. */
type PropertyNamesInput = {
  readonly node: JsonSchemaNode;
  readonly definitions: JsonSchema.Definitions;
  readonly path: string;
  readonly discriminators: ReadonlyArray<string>;
};

type MemberNamesInput = { readonly values: ReadonlyArray<string>; readonly path: string };

/**
 * Every field and closed-set member of each operation's query, body and output under its method and path, and of the
 * error body under `errors body`, as `/v1` encodes them. A field's steps are a property's wire key, `[]` for an array's
 * items, and a variant named by its single-value enums, as in
 * `output.dispatches[][status=settled,basis=usage].input_tokens`. A member follows its field after `=`, a nullable
 * value adds no step, and a variant that keeps the wire's rest adds no name; the walk's functions call each other.
 */
export function fieldNames(): FieldNames {
  /** An operation's query, body and output, each at its method, path and part. */
  const operationParts: (operation: Operation) => ReadonlyArray<WirePart> = (operation) => {
    const operationPart: (part: (typeof WIRE_PARTS)[number]) => WirePart = (part) => ({
      schema: operation[part],
      path: `${operation.method} ${operation.path} ${part}`,
    });

    return WIRE_PARTS.map(operationPart);
  };

  /** The entries of one part's JSON Schema document. */
  const partNames: (part: WirePart) => ReadonlyArray<FieldEntry> = (part) => {
    const { schema, definitions } = Schema.toJsonSchemaDocument(part.schema);

    return nodeNames({ node: decodedNode({ node: schema, definitions }), definitions, path: part.path });
  };

  const parts = Record.values(catalog).flatMap(operationParts);
  const entries = [...parts, { schema: ErrorBody, path: ERROR_BODY_PATH }].flatMap(partNames);

  return {
    fields: entries.filter(({ kind }) => kind === WireKind.Fields).map(({ entry }) => entry),
    members: entries.filter(({ kind }) => kind === WireKind.Members).map(({ entry }) => entry),
  };
}

/**
 * The entries under a node at its path: a union's, an enum's members, an array's items or an object's properties. An
 * enum of one value outside a variant's name is a member too, such as `GET /health output.service=mechane`.
 */
function nodeNames({ node, definitions, path }: NodeNamesInput): ReadonlyArray<FieldEntry> {
  if (node.anyOf.length > 0) {
    const branches = node.anyOf.map((branch) => decodedNode({ node: branch, definitions }));

    return unionNames({ branches, definitions, path });
  }

  if (node.enum.length > 0) {
    return memberNames({ values: node.enum, path });
  }

  if (Option.isSome(node.items)) {
    const items = decodedNode({ node: node.items.value, definitions });

    return nodeNames({ node: items, definitions, path: `${path}[]` });
  }

  return propertyNames({ node, definitions, path, discriminators: [] });
}

/**
 * The entries under a union. An enum branch adds its members, as a closed set's do beside an unknown member's text.
 * Another branch adds the entries under it, such as a nullable array's items, and the objects add theirs.
 */
function unionNames({ branches, definitions, path }: UnionNamesInput): ReadonlyArray<FieldEntry> {
  const isObject: (branch: JsonSchemaNode) => boolean = (branch) => Option.contains(branch.type, OBJECT_TYPE);
  const objects = branches.filter(isObject);
  const others = branches.filter(Predicate.not(isObject));

  /** The entries under a branch that is no object: an enum's members, or the entries under any other node. */
  const branchNames: (branch: JsonSchemaNode) => ReadonlyArray<FieldEntry> = (branch) => {
    if (branch.enum.length > 0) {
      return memberNames({ values: branch.enum, path });
    }

    return nodeNames({ node: branch, definitions, path });
  };

  return [...others.flatMap(branchNames), ...objectNames({ objects, definitions, path })];
}

/**
 * The entries under a union's objects: one object's properties stand at the union's path, as a nullable struct's do,
 * and two or more are its variants. A variant that keeps the wire's rest adds none.
 */
function objectNames({ objects, definitions, path }: ObjectNamesInput): ReadonlyArray<FieldEntry> {
  if (objects.length === 1) {
    return objects.flatMap((node) => propertyNames({ node, definitions, path, discriminators: [] }));
  }

  /** Whether a variant keeps the wire's rest, as a variant read tolerantly does. */
  const keepsRest: (node: JsonSchemaNode) => boolean = (node) =>
    node.allOf.some(({ additionalProperties }) => Option.isSome(additionalProperties));

  return objects.filter(Predicate.not(keepsRest)).flatMap((node) => variantNames({ node, definitions, path }));
}

/**
 * A variant's own path, so a variant with no other property still has an entry, then its properties under its name. Its
 * discriminators give the name: the properties that hold one value, such as `[status=settled,basis=usage]`, which it
 * does not list again.
 */
function variantNames({ node, definitions, path }: NodeNamesInput): ReadonlyArray<FieldEntry> {
  /** A property's discriminator, when it holds one value. */
  const discriminator: (property: PropertyEntry) => ReadonlyArray<Discriminator> = ([key, property]) => {
    const values = decodedNode({ node: property, definitions }).enum;

    if (values.length !== 1) {
      return [];
    }

    return values.map((value) => ({ key, value }));
  };

  const discriminators = Record.toEntries(node.properties).flatMap(discriminator);
  const discriminatorName: (named: Discriminator) => string = ({ key, value }) => `${key}=${value}`;
  const variantPath = `${path}[${discriminators.map(discriminatorName).join(',')}]`;

  return [
    { kind: WireKind.Fields, entry: variantPath },
    ...propertyNames({ node, definitions, path: variantPath, discriminators: discriminators.map(({ key }) => key) }),
  ];
}

/** Each property's field under the path, then the entries under it; a discriminator names the path instead. */
function propertyNames({ node, definitions, path, discriminators }: PropertyNamesInput): ReadonlyArray<FieldEntry> {
  const isListed: (property: PropertyEntry) => boolean = ([key]) => !discriminators.includes(key);

  /** A property's field, then the entries under it. */
  const fieldEntries: (property: PropertyEntry) => ReadonlyArray<FieldEntry> = ([key, property]) => [
    { kind: WireKind.Fields, entry: `${path}.${key}` },
    ...nodeNames({ node: decodedNode({ node: property, definitions }), definitions, path: `${path}.${key}` }),
  ];

  return Record.toEntries(node.properties).filter(isListed).flatMap(fieldEntries);
}

/** Each value of a closed set as a member under its field. */
function memberNames({ values, path }: MemberNamesInput): ReadonlyArray<FieldEntry> {
  const memberEntry: (value: string) => FieldEntry = (value) => ({ kind: WireKind.Members, entry: `${path}=${value}` });

  return values.map(memberEntry);
}
