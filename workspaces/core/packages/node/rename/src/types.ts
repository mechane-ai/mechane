import type { Option, Queue, Ref } from 'effect';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import type {
  DeclarationMissing,
  DeclarationShared,
  FileFailed,
  MoveFailed,
  MoveTaken,
  NamesRefused,
  NothingRenamed,
  ServerExited,
  ServerRefused,
} from './errors.ts';
import type { RenameMap, ServerMessage, TextEdit } from './schemas.ts';

/** A position of a file, by its absolute path and the server's zero-based line and UTF-16 character. */
export type Site = { readonly path: string; readonly line: number; readonly character: number };

/** One edit of a file, by its absolute path. */
export type FileEdit = { readonly path: string; readonly edit: TextEdit };

/** The language server's process, which reads requests on its standard input and answers on its standard output. */
export type ServerChild = ChildProcessByStdio<Writable, Readable, null>;

/** A file's absolute path. */
export type PathInput = { readonly path: string };

/**
 * A running language server: its process, the messages no request took yet, the next request's id, and the version of
 * each document the program gave it, by URI.
 */
export type LanguageServer = {
  readonly child: ServerChild;
  readonly messages: Queue.Queue<ServerMessage, ServerExited>;
  readonly ids: Ref.Ref<number>;
  readonly versions: Ref.Ref<ReadonlyMap<string, number>>;
};

/** One identifier a map renames through the language server. */
export type IdentifierRename = RenameMap['identifiers'][number];

/** One file a map moves. */
export type FileMove = RenameMap['files'][number];

/** One wire string a map rewrites. */
export type StringRename = RenameMap['strings'][number];

/** A binding to rename: its name, its new name, and the file that declares it. */
export type BindingRename = {
  readonly from: string;
  readonly to: string;
  /** Absent unless two files declare the name, since one declaration names its file. */
  readonly file: Option.Option<string>;
};

/** Every failure a run of the rename program ends with. */
export type RenameFailure =
  | FileFailed
  | MoveFailed
  | MoveTaken
  | NamesRefused
  | DeclarationMissing
  | DeclarationShared
  | NothingRenamed
  | ServerRefused
  | ServerExited;
