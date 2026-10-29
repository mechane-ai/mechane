import { NodeType } from '../constants.ts';
import { isTypeDeclaration } from './is-type-declaration.ts';
import type { MovableInput } from './types.ts';

/** The kind of a variable declaration that a normalizer moves: a constant, which nothing reassigns. */
const CONSTANT_KIND = 'const';

/** Whether a declaration may move: a type, an interface, a class or one constant, and none of them `declare`d. */
export function isMovable({ declaration }: MovableInput): boolean {
  if ('declare' in declaration && declaration.declare) {
    return false;
  }

  if (declaration.type === NodeType.VariableDeclaration) {
    return declaration.kind === CONSTANT_KIND && declaration.declarations.length === 1;
  }

  return declaration.type === NodeType.ClassDeclaration || isTypeDeclaration({ declaration });
}
