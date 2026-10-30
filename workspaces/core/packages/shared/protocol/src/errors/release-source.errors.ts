import { RecordText } from '@mechane/records';
import { Schema } from 'effect';

/** The public artifact source failed or rejected the read; the reason excludes its response body. */
export class ReleaseSourceUnavailable extends Schema.TaggedError<ReleaseSourceUnavailable>()(
  'ReleaseSourceUnavailable',
  { key: RecordText, reason: RecordText },
) {}
