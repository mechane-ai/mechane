import type { SlackInstallation, SlackInstallationResult } from '@mechane/protocol';
import type { RecordsInput } from '@mechane/store';
import type { Option } from 'effect';
import { deleteSlackInstallation } from './delete-slack-installation.ts';
import { listSlackInstallations } from './list-slack-installations.ts';
import { readSlackInstallation } from './read-slack-installation.ts';
import { saveSlackInstallation } from './save-slack-installation.ts';
import type { SaveSlackInstallationInput, SlackInstallationIdInput } from './types.ts';

/** Slack connection metadata belongs to one workspace and refers to separately managed credentials. */
export type SlackInstallationRecords = ReturnType<typeof slackInstallationRecords>;

/** Binds connection operations to the owning workspace's database. */
export function slackInstallationRecords({ sql }: RecordsInput) {
  return {
    saveSlackInstallation: (input: SaveSlackInstallationInput): SlackInstallationResult =>
      saveSlackInstallation({ sql, ...input }),
    slackInstallations: (): ReadonlyArray<SlackInstallation> => listSlackInstallations({ sql }),
    slackInstallation: (input: SlackInstallationIdInput): Option.Option<SlackInstallation> =>
      readSlackInstallation({ sql, ...input }),
    deleteSlackInstallation: (input: SlackInstallationIdInput): void => deleteSlackInstallation({ sql, ...input }),
  };
}
