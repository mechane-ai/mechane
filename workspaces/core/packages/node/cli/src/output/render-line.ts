import { ErrorRecord } from '@mechane/cli-kernel';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ENVELOPE_SCHEMA_VERSION, RecordKind } from './constants.ts';

/** A line with a command's result, or one record of a command that streams. */
const ResultLine = wireStruct({
  fields: {
    schemaVersion: Schema.Int,
    record: Schema.Literal(RecordKind.Result),
    command: Schema.String,
    result: Schema.Unknown,
  },
});

type ResultLine = typeof ResultLine.Type;

/** A line with one error of a run. */
const ErrorLine = wireStruct({
  fields: {
    schemaVersion: Schema.Int,
    record: Schema.Literal(RecordKind.Error),
    /** Absent, as null, when the command line names no command. */
    command: Schema.OptionFromNullOr(Schema.String),
    error: ErrorRecord,
  },
});

type ErrorLine = typeof ErrorLine.Type;

/** One line `--output jsonl` writes: the command's result, or one error of its run. */
const LineRecord = Schema.Union([ResultLine, ErrorLine]);

type LineRecord = typeof LineRecord.Type;

/** A JSON Lines record before the renderer adds the schema version. */
type RenderLineInput = { readonly line: Omit<ResultLine, 'schemaVersion'> | Omit<ErrorLine, 'schemaVersion'> };

/** One JSON Lines record of a run; the output module built it to the record's type, so encoding cannot fail. */
export function renderLine({ line }: RenderLineInput): string {
  return JSON.stringify(Schema.encodeSync(LineRecord)({ schemaVersion: ENVELOPE_SCHEMA_VERSION, ...line }));
}
