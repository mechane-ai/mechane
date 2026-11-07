import { requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SavedCredential = Schema.Struct({ token: Schema.String });
type Canary = { readonly label: string; readonly value: string };

export async function credentialsStayOutOfDurableExecution({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);

  const canaries: Array<Canary> = [
    { label: 'the model provider key', value: fixtures.model.apiKey },
    { label: 'the GitHub OAuth secret', value: fixtures.github.clientSecret },
    { label: 'the Slack bot token', value: fixtures.slack.botToken },
    { label: 'the Slack signing secret', value: fixtures.slack.signingSecret },
    { label: 'the Nexus request key', value: fixtures.nexus.apiKey },
    { label: 'the Nexus callback secret', value: fixtures.nexus.signingSecret },
  ];

  const folders = await readdir(stack.stateDirectory, { withFileTypes: true });

  const accountFolders = folders.filter((folder) => folder.isDirectory() && folder.name.startsWith('account-'));

  for (const folder of accountFolders) {
    const file = join(stack.stateDirectory, folder.name, 'mechane', 'credentials.json');

    const source = await readFile(file, 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }

      throw error;
    });

    if (source !== undefined) {
      const credential = Schema.decodeUnknownSync(Schema.fromJsonString(SavedCredential))(source);

      canaries.push({ label: 'a CLI key', value: credential.token });
    }
  }

  const [database, log] = await Promise.all([stack.dumpStorage(), readFile(stack.serverLog, 'utf8')]);

  for (const canary of canaries) {
    assertCanaryAbsent({ canary, database, log });
  }
}

type CanaryInspection = { readonly canary: Canary; readonly database: string; readonly log: string };

function assertCanaryAbsent({ canary, database, log }: CanaryInspection): void {
  const representations = [
    canary.value,
    Buffer.from(canary.value).toString('hex'),
    Buffer.from(canary.value).toString('base64'),
  ];

  for (const representation of representations) {
    assert.equal(database.includes(representation), false, `Postgres contains ${canary.label}`);
    assert.equal(log.includes(representation), false, `The server log contains ${canary.label}`);
  }
}
