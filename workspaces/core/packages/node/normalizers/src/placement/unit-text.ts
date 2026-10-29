import type { Move, UnitStatement } from '@mechane/modules';

/** One statement of a moved unit, and whether the unit lands without `export`. */
type UnitStatementTextInput = { readonly statement: UnitStatement; readonly isPrivate: boolean };

/** A moved unit's text at its destination: without `export` where it lands private, and as written elsewhere. */
export function unitText({ unit, isPrivate }: Move): string {
  return unit.statements.map((statement) => unitStatementText({ statement, isPrivate })).join('\n\n');
}

/** One statement's text at the unit's destination. */
function unitStatementText({ statement, isPrivate }: UnitStatementTextInput): string {
  if (isPrivate) {
    return statement.privateText;
  }

  return statement.text;
}
