import { droppedNameKey, unitNeeds } from '@mechane/modules';
import type { AddedStatement, FileFacts, ModuleName, Move, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import { landingOffsets } from '../landings/landing-offsets.ts';
import type { Landing } from '../types.ts';
import { neededImports } from './needed-imports.ts';
import { ownImports } from './own-imports.ts';
import type { FileRewrite, Insertion, PathRewrite } from './types.ts';
import { unitText } from './unit-text.ts';
import { unusedNames } from './unused-names.ts';

/** A retargeted statement, and the keys of the names that the file drops as unused. */
type IsKeptInput = { readonly statement: AddedStatement; readonly unusedKeys: ReadonlySet<string> };

/** One round's index and moves, the statements that take moved units, and one file with its facts. */
type FileRewriteInput = {
  readonly index: PlacementIndex;
  readonly moves: ReadonlyArray<Move>;
  readonly retargets: ReadonlyArray<PathRewrite>;
  /** Absent for a role file the round creates. */
  readonly facts: Option.Option<FileFacts>;
  readonly path: string;
};

/** What a round changes in one file: the units it loses and gains, their imports, and its retargeted statements. */
export function fileRewrite({ index, moves, retargets, facts, path }: FileRewriteInput): FileRewrite {
  const leaving = moves.filter(({ unit }) => unit.path === path);
  const removed = leaving.flatMap(({ unit }) => unit.statements);
  const incoming = moves.filter(({ to }) => to === path);
  const needs = incoming.flatMap((move) => unitNeeds({ index, move }));
  const unused = Option.match(facts, { onNone: () => [], onSome: (file) => unusedNames({ file, removed, needs }) });
  const unusedKeys: ReadonlySet<string> = new Set(unused.map(droppedNameKey));
  const own = retargets.filter((rewrite) => rewrite.path === path);
  const imports = neededImports({ index, facts, needs, incoming });

  /** The texts of the moves that land a unit at its offset. */
  const insertions: (landing: Landing) => ReadonlyArray<Insertion> = ({ unit, offset }) => {
    /** The move's text at the landing's offset. */
    const insertion: (move: Move) => Insertion = (move) => ({ offset, text: unitText(move) });

    return incoming.filter((move) => move.unit === unit).map(insertion);
  };

  return {
    dropped: [...unused, ...own.flatMap(({ dropped }) => dropped), ...imports.dropped],
    added: [
      ...own.flatMap(({ added }) => added).filter((statement) => isKept({ statement, unusedKeys })),
      ...imports.added,
      ...Option.match(facts, { onNone: () => [], onSome: (file) => ownImports({ file, leaving, removed }) }),
    ],
    removed,
    inserted: landingOffsets({ facts, units: incoming.map(({ unit }) => unit) }).flatMap(insertions),
  };
}

/** Whether a retargeted statement keeps a name: one whose statement the file drops as unused keeps none. */
function isKept({ statement, unusedKeys }: IsKeptInput): boolean {
  /** Whether the statement that starts there keeps any name the retargeted one takes. */
  const keepsName: (start: number) => boolean = (start) => {
    /** Whether the file keeps the name. */
    const isUsed: (name: ModuleName) => boolean = ({ local }) => !unusedKeys.has(droppedNameKey({ start, local }));

    return statement.names.some(isUsed);
  };

  return Option.match(statement.anchor, { onNone: () => true, onSome: keepsName });
}
