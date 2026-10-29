import { Array, Option } from 'effect';
import { StatementKind } from '../constants.ts';
import type { AddedStatement } from '../types.ts';
import { statementKey } from './statement-key.ts';
import { uniqueNames } from './unique-names.ts';

type MergedStatementsInput = { readonly added: ReadonlyArray<AddedStatement> };

type MergeKeyInput = { readonly statement: AddedStatement };

/**
 * The added statements with the names of each import's type-ness and module merged into the first, which keeps its
 * anchor; re-exports merge only at one anchor.
 */
export function mergedStatements({ added }: MergedStatementsInput): ReadonlyArray<AddedStatement> {
  const groups = [...Map.groupBy(added, (statement) => mergeKey({ statement })).values()];

  /** A group's first statement, with every name of the group once. */
  const mergedGroup: (group: ReadonlyArray<AddedStatement>) => ReadonlyArray<AddedStatement> = (group) => {
    const names = uniqueNames({ names: group.flatMap((statement) => statement.names) });

    return Option.toArray(Array.head(group)).map((first) => ({ ...first, names }));
  };

  return groups.flatMap(mergedGroup);
}

/** What merges two added statements: an import's key, and a re-export's key at its anchor. */
function mergeKey({ statement }: MergeKeyInput): string {
  if (statement.kind === StatementKind.Import) {
    return statementKey(statement);
  }

  const anchor = Option.match(statement.anchor, { onNone: () => '', onSome: String });

  return `${statementKey(statement)} ${anchor}`;
}
