import { relativeSpecifier } from '@mechane/program';
import { Option } from 'effect';
import { StatementKind } from '../constants.ts';
import type { ModuleName, Move, StatementForm } from '../types.ts';

/** A move, and the module, file and name an import at its destination takes. */
type ImportFormInput = {
  readonly move: Move;
  readonly specifier: string;
  /** Absent for a package's module, which every file names by the same specifier. */
  readonly target: Option.Option<string>;
  readonly name: ModuleName;
};

/** The value import of one name at a move's destination: from its file, relative to the destination, or a package. */
export function importForm({ move, specifier, target, name }: ImportFormInput): StatementForm {
  return {
    kind: StatementKind.Import,
    isTypeOnly: false,
    specifier: Option.match(target, {
      onNone: () => specifier,
      onSome: (file) => relativeSpecifier({ importer: move.to, target: file }),
    }),
    target,
    names: [name],
  };
}
