import { Visitor } from 'oxc-parser';
import type { MemberExpression, TSQualifiedName } from 'oxc-parser';
import { NodeType } from '../constants.ts';
import type { ProgramInput } from './types.ts';

/** A node whose property or right part names no binding. */
type NamedPartNode = MemberExpression | TSQualifiedName;

type NamedPartOffsetInput = { readonly node: NamedPartNode };

/** The offsets of members' uncomputed properties and of qualified names' right parts. */
export function namedPartOffsets({ program }: ProgramInput): ReadonlyArray<number> {
  const named: Array<NamedPartNode> = [];

  /** Keeps a node with a named part. */
  const keepNamed: (node: NamedPartNode) => void = (node) => {
    named.push(node);
  };

  new Visitor({ MemberExpression: keepNamed, TSQualifiedName: keepNamed }).visit(program);

  return named.flatMap((node) => namedPartOffset({ node }));
}

/** A member's uncomputed property, or a qualified name's right part. */
function namedPartOffset({ node }: NamedPartOffsetInput): ReadonlyArray<number> {
  if (node.type === NodeType.QualifiedName) {
    return [node.right.start];
  }

  if (node.computed) {
    return [];
  }

  return [node.property.start];
}
