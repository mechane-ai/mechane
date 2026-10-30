import { SlackInstallation } from '@mechane/protocol';
import { Schema } from 'effect';

/** The stored JSON includes credential references while secret values remain in the credential vault. */
export const SerializedSlackInstallation = Schema.fromJsonString(SlackInstallation);
export type SerializedSlackInstallation = typeof SerializedSlackInstallation.Type;

/** Reads validate the saved connection against the same schema used by runtime writes. */
export const SlackInstallationRow = Schema.Struct({ installation: SerializedSlackInstallation });
export type SlackInstallationRow = typeof SlackInstallationRow.Type;
