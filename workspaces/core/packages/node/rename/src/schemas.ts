import { Schema } from 'effect';

/** A position in a document, as the language server counts it: zero-based lines and UTF-16 characters. */
const Position = Schema.Struct({ line: Schema.Int, character: Schema.Int });

/** One replacement of a range of a document. */
export const TextEdit = Schema.Struct({
  range: Schema.Struct({ start: Position, end: Position }),
  newText: Schema.String,
});

export type TextEdit = typeof TextEdit.Type;

/** A JSON-RPC message's id: the program numbers its requests, and the server may number its own or name them. */
const MessageId = Schema.Union([Schema.Int, Schema.String]);

/** A JSON-RPC message the server writes: an answer to one of the program's requests, or its own request. */
export const ServerMessage = Schema.Struct({
  /** Absent for a notification. */
  id: Schema.OptionFromOptionalKey(MessageId),
  /** Absent for an answer. */
  method: Schema.OptionFromOptionalKey(Schema.String),
  /** Absent for each message but an answer that succeeded. */
  result: Schema.optionalKey(Schema.Unknown),
  /** Absent for each message but an answer the server refused. */
  error: Schema.OptionFromOptionalKey(Schema.Struct({ message: Schema.String })),
});

export type ServerMessage = typeof ServerMessage.Type;

/**
 * One identifier to rename through the language server: the file that declares it, text of its declaring line that
 * holds the name, and the old and new names. A declaration the file no longer holds was renamed already.
 */
const IdentifierRename = Schema.Struct({
  file: Schema.String,
  at: Schema.String,
  from: Schema.String,
  to: Schema.String,
});

/** One file to move, relative to the workspace; every relative import of it follows. */
const FileMove = Schema.Struct({ from: Schema.String, to: Schema.String });

/**
 * One wire string to rewrite in every text file, such as a command line, a path or a code no compiler reads. A string
 * as plain as a column's name, which a later branch may use for something else, is rewritten only in the folder
 * `within` names, relative to the workspace.
 */
const StringRename = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  /** Absent to rewrite the string in every text file. */
  within: Schema.OptionFromOptionalKey(Schema.String),
});

/** The rename map: the identifiers, the files and the strings, which the passes apply in that order. */
export const RenameMap = Schema.fromJsonString(
  Schema.Struct({
    identifiers: Schema.Array(IdentifierRename),
    files: Schema.Array(FileMove),
    strings: Schema.Array(StringRename),
  }),
);

export type RenameMap = typeof RenameMap.Type;
