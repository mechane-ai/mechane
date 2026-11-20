import { isWellFormedText } from '@mechane/records';
import { Schema } from 'effect';

/** A notice may include a complete provider message within the bounded admission request. */
export const NOTIFICATION_TEXT_MAX_CHARS = 65_536;

/** The longest instructions an evaluated agent definition may carry. */
const INSTRUCTIONS_MAX_CHARS = 65_536;

/** New notices accept whole Unicode text within the admission limit. */
export const NotificationText = Schema.String.check(
  isWellFormedText,
  Schema.isBetweenLength(1, NOTIFICATION_TEXT_MAX_CHARS),
);

export type NotificationText = typeof NotificationText.Type;

/** Agent instructions bounded for evaluation fixtures. */
export const Instructions = Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, INSTRUCTIONS_MAX_CHARS));

export type Instructions = typeof Instructions.Type;
