import type { Option } from 'effect';
import type { Directive, ModuleDeclaration, ParseResult, Statement } from 'oxc-parser';
import type { StatementKind } from './constants.ts';

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

/** The file that declares an export, relative to the workspace, and the name it declares it under. */
export type Origin = { readonly path: string; readonly name: string };

/**
 * The files a normalizer rewrites, relative to the workspace: those under `paths`, every file when they are none. No
 * file an `excluded` glob matches is one, such as the code only the live release verification reaches.
 */
export type NormalizerScope = { readonly paths: ReadonlyArray<string>; readonly excluded: ReadonlyArray<string> };

/** A replacement of the text between two offsets; an insertion starts and ends at one offset. */
export type TextEdit = { readonly start: number; readonly end: number; readonly text: string };
