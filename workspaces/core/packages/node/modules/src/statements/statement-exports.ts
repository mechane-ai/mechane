import { Option } from 'effect';
import type { ExportNamedDeclaration, ExportSpecifier, Statement } from 'oxc-parser';
import { NodeType } from '../constants.ts';
import type { ExportLink } from '../types.ts';
import { declaredNames } from './declared-names.ts';
import { moduleName } from './module-name.ts';
import { resolvedPath } from './resolved-path.ts';

/** A name a file exports, and how it exports it. */
type NamedLink = readonly [string, ExportLink];

/** A file relative to the workspace, and one of its top-level statements. */
type StatementExportsInput = { readonly path: string; readonly statement: Statement };

/** A file relative to the workspace, one of its re-export statements, and the specifier the statement names. */
type ReexportLinksInput = {
  readonly path: string;
  readonly statement: ExportNamedDeclaration;
  readonly specifier: string;
};

/** The names a top-level statement exports, each with how the file exports it; none for any other statement. */
export function statementExports({ path, statement }: StatementExportsInput): ReadonlyArray<NamedLink> {
  if (statement.type !== NodeType.ExportNamedDeclaration) {
    return [];
  }

  const from = Option.fromNullishOr(statement.source);

  if (Option.isSome(from)) {
    return reexportLinks({ path, statement, specifier: from.value.value });
  }

  /** A listed binding of the file under the name it exports. */
  const listedLink: (specifier: ExportSpecifier) => NamedLink = ({ local, exported }) => [
    moduleName({ node: exported }),
    { path, name: moduleName({ node: local }), isLocal: true },
  ];

  const declared = Option.toArray(Option.fromNullishOr(statement.declaration)).flatMap((declaration) =>
    declaredNames({ declaration }),
  );

  return [
    ...statement.specifiers.map(listedLink),
    ...declared.map((name) => [name, { path, name, isLocal: true }] as const),
  ];
}

/** A re-export statement's links; none from a package, which no workspace file declares. */
function reexportLinks({ path, statement, specifier }: ReexportLinksInput): ReadonlyArray<NamedLink> {
  const target = resolvedPath({ importer: path, specifier });

  if (Option.isNone(target)) {
    return [];
  }

  /** A re-exported name, linked to the file and name it comes from. */
  const reexportLink: (exported: ExportSpecifier) => NamedLink = ({ local, exported }) => [
    moduleName({ node: exported }),
    { path: target.value, name: moduleName({ node: local }), isLocal: false },
  ];

  return statement.specifiers.map(reexportLink);
}
