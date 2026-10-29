import type { Option } from 'effect';
import type { Declaration, Directive, ModuleDeclaration, ParseResult, Statement } from 'oxc-parser';
import type { BlockerKind, RoleFile, StatementKind } from './constants.ts';

/** A top-level statement and the declaration it holds, with whether the statement exports it. */
export type TopLevelDeclaration = {
  readonly statement: Statement;
  readonly declaration: Declaration;
  readonly isExported: boolean;
};

/** One TypeScript file of a source root, read whole and parsed once: its path, its text and oxc's parse of it. */
export type ParsedSource = { readonly path: string; readonly text: string; readonly parsed: ParseResult };

/** A statement of a block, a program, a switch case or a namespace, as the parser gives it. */
export type ListedStatement = Statement | Directive | ModuleDeclaration;

/** One name a statement takes from its module, and the name it binds or exports, which may differ. */
export type ModuleName = { readonly imported: string; readonly local: string };

/**
 * What a statement says: its kind, whether it takes types only, its module's specifier and the names it takes. Its
 * target is the workspace file a relative specifier resolves to, relative to the workspace.
 */
export type StatementForm = {
  readonly kind: StatementKind;
  readonly isTypeOnly: boolean;
  readonly specifier: string;
  /** Absent for a package's specifier. */
  readonly target: Option.Option<string>;
  readonly names: ReadonlyArray<ModuleName>;
};

/** Where a statement stands in its file: its first offset and the offset after it. */
export type StatementSpan = { readonly start: number; readonly end: number };

/**
 * How a file exports a name: declared in the file itself under `name`, or re-exported from the file and name another
 * export names.
 */
export type ExportLink = { readonly path: string; readonly name: string; readonly isLocal: boolean };

/** An import or a re-export statement of a file that takes only named bindings, and where it stands. */
export type ModuleStatement = StatementForm & StatementSpan;

/** Each file's exports by the name each exports, by the file's path relative to the workspace. */
export type ExportTable = ReadonlyMap<string, ReadonlyMap<string, ExportLink>>;

/** A name a rewrite drops: the start of the statement that takes it, and the name it binds or exports there. */
export type DroppedName = { readonly start: number; readonly local: string };

/**
 * A statement a rewrite adds. A statement of the file with the same kind, type-ness and module absorbs its names; else
 * it lands after the statement that starts at its anchor.
 */
export type AddedStatement = StatementForm & {
  /** Absent to land after the file's last statement. */
  readonly anchor: Option.Option<number>;
};

/**
 * What a round reads of the workspace: each file's facts, every export, each declaration's uses, the entries, and the
 * declarations they export, which placement pins.
 */
export type PlacementIndex = {
  readonly files: ReadonlyMap<string, FileFacts>;
  readonly table: ExportTable;
  readonly uses: ReadonlyMap<string, ReadonlyArray<NameUse>>;
  readonly entries: ReadonlySet<string>;
  readonly pinned: ReadonlySet<string>;
};

/** What a round reads of one file. */
export type FileFacts = {
  readonly source: ParsedSource;
  readonly statements: ReadonlyArray<ModuleStatement>;
  readonly units: ReadonlyMap<string, Unit>;
  readonly names: ReadonlyMap<string, TopLevelName>;
  readonly references: ReadonlyArray<Reference>;
  /** The offset after the last import or re-export, where declarations moved into the file land. */
  readonly insertion: number;
};

/**
 * A unit's move to the file it belongs in: unexported into its one user, or exported into the role file of the nearest
 * folder that holds every user. A unit only other units of its file name moves with them, unexported.
 */
export type Move = {
  readonly unit: Unit;
  readonly to: string;
  /** Whether it lands without `export`: beside its one user, or beside the units that carry it. */
  readonly isPrivate: boolean;
  /** Whether the unit's own file still names it, and so imports it from where it lands. */
  readonly hasOwnUse: boolean;
  /** The keys of the units of its file that alone name it, each of which must land where it does. */
  readonly carriers: ReadonlyArray<string>;
};

/**
 * One name's movable declarations at a file's top level: a constant or a class, a type or an interface, or such a pair.
 * It holds the references their text makes to other names.
 */
export type Unit = {
  readonly name: string;
  readonly path: string;
  /** The line its first statement starts on, counted from 1. */
  readonly line: number;
  readonly statements: ReadonlyArray<UnitStatement>;
  readonly references: ReadonlyArray<Reference>;
  readonly isTypeOnly: boolean;
  /** Whether its text holds `import.meta` or a dynamic `import()`, whose value depends on the file's folder. */
  readonly isLocated: boolean;
  /** The role file its kind belongs in; absent for a value no role file holds, such as a function. */
  readonly kindRole: Option.Option<RoleFile>;
};

/** A name a moving unit uses, and the binding its destination needs for it. */
export type Need = {
  readonly local: string;
  /** The key of what the name binds: the declaration it takes through every re-export, or a package's export. */
  readonly origin: string;
  /** Absent for a name the unit's file imports rather than declares. */
  readonly declared: Option.Option<TopLevelName>;
  /** Whether every use of the name stands in a type, or it names a type, so a type-only import binds it. */
  readonly isTypeOnly: boolean;
  /** The value import that binds the name at the destination; the needs of one name merge its type-ness. */
  readonly form: StatementForm;
};

/**
 * One statement of a unit: the span its removal takes, with its attached comments and its line, and its text with and
 * without the `export` it starts with.
 */
export type UnitStatement = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly privateText: string;
};

/**
 * A name a file declares at its top level: whether the file exports it, and whether it names a type alone. A value
 * import needs the file to export its value.
 */
export type TopLevelName = {
  readonly isExported: boolean;
  readonly isValueExported: boolean;
  readonly isTypeOnly: boolean;
};

/** A name a statement of a file takes, which a move of the declaration it takes redirects. */
export type NameUse = { readonly path: string; readonly statement: ModuleStatement; readonly name: ModuleName };

/** An identifier where it names a binding: its name, its offset, and whether it stands in a type. */
export type Reference = { readonly name: string; readonly offset: number; readonly isType: boolean };

/** The file that declares an export, relative to the workspace, and the name it declares it under. */
export type Origin = { readonly path: string; readonly name: string };

/**
 * The files a normalizer rewrites, relative to the workspace: those under `paths`, every file when they are none. No
 * file an `excluded` glob matches is one, such as the code only the live release verification reaches.
 */
export type NormalizerScope = { readonly paths: ReadonlyArray<string>; readonly excluded: ReadonlyArray<string> };

/** A replacement of the text between two offsets; an insertion starts and ends at one offset. */
export type TextEdit = { readonly start: number; readonly end: number; readonly text: string };

/** Why placement leaves a declaration where it is. */
export type Blocker = KindBlocker | HiddenNeedBlocker;

/** A blocker its kind alone describes. */
type KindBlocker = { readonly kind: Exclude<BlockerKind, typeof BlockerKind.HiddenNeed> };

/** A hidden need, with the name of each declaration its file does not export. */
type HiddenNeedBlocker = { readonly kind: typeof BlockerKind.HiddenNeed; readonly names: ReadonlyArray<string> };
