import { Option } from 'effect';
import type { BindingPattern, Declaration } from 'oxc-parser';
import { NodeType } from '../constants.ts';

type DeclaredNamesInput = { readonly declaration: Declaration };

type BindingNameInput = { readonly id: BindingPattern };

/** The names a top-level declaration binds; none for a module or a global augmentation, which binds no name. */
export function declaredNames({ declaration }: DeclaredNamesInput): ReadonlyArray<string> {
  if (declaration.type === NodeType.VariableDeclaration) {
    return declaration.declarations.flatMap(({ id }) => bindingName({ id }));
  }

  if (declaration.type === NodeType.ModuleDeclaration) {
    return [];
  }

  return Option.toArray(Option.fromNullishOr(declaration.id)).map(({ name }) => name);
}

/** The name a variable binds; none for a destructuring, which no module statement of this workspace exports. */
function bindingName({ id }: BindingNameInput): ReadonlyArray<string> {
  if (id.type !== NodeType.Identifier) {
    return [];
  }

  return [id.name];
}
