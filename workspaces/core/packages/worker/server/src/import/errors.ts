import { Schema } from 'effect';

export class HistoryImportFailed extends Schema.TaggedError<HistoryImportFailed>()('HistoryImportFailed', {
  reason: Schema.String,
}) {}
