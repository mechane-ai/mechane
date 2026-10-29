import { statementText } from '../statements/statement-text.ts';
import type { StatementForm } from '../types.ts';

type FormsTextInput = { readonly forms: ReadonlyArray<StatementForm> };

/** The text of statements, one to a line. */
export function formsText({ forms }: FormsTextInput): string {
  return forms.map((form) => statementText({ statement: form })).join('\n');
}
