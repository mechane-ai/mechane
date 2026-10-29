import { SlackBinding } from '@mechane/protocol';
import { Schema } from 'effect';

/** The persisted form of a fixed Slack audience and its mutable switches. */
export const SerializedSlackBinding = Schema.fromJsonString(SlackBinding);

export type SerializedSlackBinding = typeof SerializedSlackBinding.Type;

/** A binding row used for conflict checks and audience lookup. */
export const SlackBindingRow = Schema.Struct({ binding: SerializedSlackBinding });

export type SlackBindingRow = typeof SlackBindingRow.Type;
