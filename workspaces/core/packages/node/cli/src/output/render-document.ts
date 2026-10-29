import { ErrorRecord } from '@mechane/cli-kernel';
import { JSON_INDENT_CHARS } from '@mechane/program';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ENVELOPE_SCHEMA_VERSION } from './constants.ts';

/** The one document `--output json` writes. */
const Envelope = wireStruct({
  fields: {
    schemaVersion: Schema.Int,
    /** Absent, as null, when the command line names no command. */
    command: Schema.OptionFromNullOr(Schema.String),
    /** Absent, as null, for a run that failed. */
    result: Schema.OptionFromNullOr(Schema.Unknown),
    errors: Schema.Array(ErrorRecord),
  },
});

type Envelope = typeof Envelope.Type;

type RenderDocumentInput = Omit<Envelope, 'schemaVersion'>;

/** The one JSON document of a run; the output module built it to the envelope's type, so encoding cannot fail. */
export function renderDocument({ command, result, errors }: RenderDocumentInput): string {
  const envelope = { schemaVersion: ENVELOPE_SCHEMA_VERSION, command, result, errors };

  return JSON.stringify(Schema.encodeSync(Envelope)(envelope), null, JSON_INDENT_CHARS);
}
