import { StatementKind } from '@mechane/modules';
import type { Move, NameUse } from '@mechane/modules';
import { relativeSpecifier } from '@mechane/program';
import { Option } from 'effect';
import type { PathRewrite } from './types.ts';

/** The workspace's entries, a moved unit, and one statement's use of it. */
type UseRewriteInput = { readonly entries: ReadonlySet<string>; readonly move: Move; readonly use: NameUse };

/**
 * A statement that takes a moved unit drops it where the unit lands, and wherever a re-export other than an entry's
 * took it. Every import that took the unit through a re-export takes it from its new file, so the re-export would be
 * dead. An entry's re-export and any other import take the unit from its new file in its place.
 */
export function useRewrite({ entries, move, use }: UseRewriteInput): PathRewrite {
  const dropped = [{ start: use.statement.start, local: use.name.local }];
  const isReexport = use.statement.kind === StatementKind.Reexport;

  if (use.path === move.to || (isReexport && !entries.has(use.path))) {
    return { path: use.path, dropped, added: [] };
  }

  const added = {
    kind: use.statement.kind,
    isTypeOnly: use.statement.isTypeOnly,
    specifier: relativeSpecifier({ importer: use.path, target: move.to }),
    target: Option.some(move.to),
    names: [{ imported: move.unit.name, local: use.name.local }],
    anchor: Option.some(use.statement.start),
  };

  return { path: use.path, dropped, added: [added] };
}
