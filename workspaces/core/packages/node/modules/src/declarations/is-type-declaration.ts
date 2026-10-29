import { NodeType } from '../constants.ts';
import type { MovableInput } from './types.ts';

/** Whether a declaration names a type alone: a type alias or an interface. */
export function isTypeDeclaration({ declaration }: MovableInput): boolean {
  return declaration.type === NodeType.TypeAliasDeclaration || declaration.type === NodeType.InterfaceDeclaration;
}
