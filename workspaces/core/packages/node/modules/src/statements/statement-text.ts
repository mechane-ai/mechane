import type { ModuleName, StatementForm } from '../types.ts';

/** The keyword that makes a statement take types only. */
const TYPE_KEYWORD = 'type ';

type StatementTextInput = { readonly statement: StatementForm };

type NameTextInput = { readonly name: ModuleName };

/** The text of a statement on one line, as `import type { Row } from './types.ts';`, which oxfmt then wraps. */
export function statementText({ statement }: StatementTextInput): string {
  const names = statement.names.map((name) => nameText({ name })).join(', ');

  const keyword: string = (() => {
    if (statement.isTypeOnly) {
      return TYPE_KEYWORD;
    }

    return '';
  })();

  return `${statement.kind} ${keyword}{ ${names} } from '${statement.specifier}';`;
}

/** A name as a statement writes it, with the name it binds after `as` where the two differ. */
function nameText({ name }: NameTextInput): string {
  if (name.imported === name.local) {
    return name.local;
  }

  return `${name.imported} as ${name.local}`;
}
