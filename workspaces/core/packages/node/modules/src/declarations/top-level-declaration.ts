import { Option } from 'effect';
import type { Declaration, Statement } from 'oxc-parser';
import { NodeType } from '../constants.ts';
import type { TopLevelDeclaration } from '../types.ts';
import { typescriptDeclaration } from './typescript-declaration.ts';

type TopLevelDeclarationInput = { readonly statement: Statement };

/** A top-level statement's declaration; none for an import, a re-export or a statement that declares nothing. */
export function topLevelDeclaration({ statement }: TopLevelDeclarationInput): Option.Option<TopLevelDeclaration> {
  if (statement.type === NodeType.ExportNamedDeclaration) {
    return Option.map(Option.fromNullishOr(statement.declaration), (declaration) => ({
      statement,
      declaration,
      isExported: true,
    }));
  }

  return Option.map(
    Option.orElse(scriptDeclaration({ statement }), () => typescriptDeclaration({ statement })),
    (declaration) => ({ statement, declaration, isExported: false }),
  );
}

/** A JavaScript declaration statement: a variable, a function or a class. */
function scriptDeclaration({ statement }: TopLevelDeclarationInput): Option.Option<Declaration> {
  if (
    statement.type === NodeType.VariableDeclaration ||
    statement.type === NodeType.FunctionDeclaration ||
    statement.type === NodeType.ClassDeclaration
  ) {
    return Option.some(statement);
  }

  return Option.none();
}
