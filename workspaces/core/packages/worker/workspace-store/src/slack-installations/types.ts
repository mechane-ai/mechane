import type { SlackInstallation } from '@mechane/protocol';
import type { SlackConnectionId } from '@mechane/records';

export type SlackInstallationIdInput = { readonly connectionId: SlackConnectionId };

export type SaveSlackInstallationInput = { readonly installation: SlackInstallation; readonly isCreateOnly: boolean };
