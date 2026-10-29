import { Visitor } from 'oxc-parser';
import type {
  AssignmentTargetProperty,
  BindingProperty,
  MethodDefinition,
  ObjectProperty,
  PropertyDefinition,
  TSMethodSignature,
  TSPropertySignature,
} from 'oxc-parser';
import type { ProgramInput } from './types.ts';

/** A node whose key names no binding unless it is computed: an object's or a class's property, or a signature's. */
type KeyedNode =
  | ObjectProperty
  | BindingProperty
  | AssignmentTargetProperty
  | PropertyDefinition
  | MethodDefinition
  | TSPropertySignature
  | TSMethodSignature;

/** The offsets of the uncomputed keys of objects, classes and signatures, which name properties, not bindings. */
export function keyOffsets({ program }: ProgramInput): ReadonlyArray<number> {
  const keyed: Array<KeyedNode> = [];

  /** Keeps a node with a key. */
  const keepKeyed: (node: KeyedNode) => void = (node) => {
    keyed.push(node);
  };

  new Visitor({
    Property: keepKeyed,
    PropertyDefinition: keepKeyed,
    MethodDefinition: keepKeyed,
    TSPropertySignature: keepKeyed,
    TSMethodSignature: keepKeyed,
  }).visit(program);

  /** Whether the key is written out, neither computed nor a shorthand's binding. */
  const isNamingKey: (node: KeyedNode) => boolean = (node) =>
    !node.computed && !('shorthand' in node && node.shorthand);

  return keyed.filter(isNamingKey).map(({ key }) => key.start);
}
