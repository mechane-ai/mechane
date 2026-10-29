import { Option } from 'effect';
import type { Declaration, Statement } from 'oxc-parser';
import { NodeType } from '../constants.ts';

type TypescriptDeclarationInput = { readonly statement: Statement };

/** A declaration statement TypeScript adds: a type alias, an interface or an enum. */
export function typescriptDeclaration({ statement }: TypescriptDeclarationInput): Option.Option<Declaration> {
  if (
    statement.type === NodeType.TypeAliasDeclaration ||
    statement.type === NodeType.InterfaceDeclaration ||
    statement.type === NodeType.EnumDeclaration
  ) {
    return Option.some(statement);
  }

  return Option.none();
}
