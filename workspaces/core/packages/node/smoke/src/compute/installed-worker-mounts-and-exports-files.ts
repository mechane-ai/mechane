import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { HttpStatusCode, MediaType } from '@mechane/records';
import {
  closeInstalledContext,
  createAccount,
  createManagedContext,
  requireFixtures,
  runInstalledBash,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXPECTED_EXPORTED_VERSIONS = 2;

async function findSandboxEnvironmentId(client: Anthropic): Promise<string> {
  for await (const environment of client.beta.environments.list()) {
    if (environment.name === 'Mechane sandbox') {
      return environment.id;
    }
  }

  throw new Error('The installation did not publish its sandbox environment');
}

/** Boots a real container, reads a mounted file, exports `/workspace/outputs/`, rejects symlinks, and deduplicates. */
export async function installedWorkerMountsAndExportsFiles({ stack }: ScenarioInput): Promise<void> {
  const { github } = requireFixtures(stack);
  const marker = randomUUID();
  const account = await createAccount({ stack, login: github.users.owner.login });
  const client = new Anthropic({ apiKey: account.token, baseURL: stack.origin.origin, maxRetries: 0 });
  const environmentId = await findSandboxEnvironmentId(client);
  const inputBody = `mounted-brief-${marker}\n`;
  const initialOutputBody = `report-initial-${marker}\n`;
  const updatedOutputBody = `report-updated-${marker}\n`;

  const uploadedInput = await client.beta.files.upload({
    file: await toFile(Buffer.from(inputBody, 'utf8'), 'brief.txt', { type: MediaType.PlainText }),
  });

  const failures: Array<unknown> = [];

  try {
    const context = await createManagedContext({
      stack,
      name: marker,
      account,
      environmentId,
      agent: {
        tools: [{ type: 'agent_toolset_20260401', default_config: { permission_policy: { type: 'always_allow' } } }],
      },
      session: { resources: [{ type: 'file', file_id: uploadedInput.id, mount_path: '/workspace/uploads/brief.txt' }] },
    });

    try {
      const firstCommand = [
        'cat /workspace/uploads/brief.txt',
        'mkdir -p /workspace/outputs',
        `printf '%s\\n' 'report-initial-${marker}' > /workspace/outputs/report.txt`,
        'ln -s /etc/hosts /workspace/outputs/escape.txt',
      ].join(' && ');

      const firstOutput = await runInstalledBash(context, { command: firstCommand });

      assert.ok(firstOutput.includes(`mounted-brief-${marker}`), 'Container failed to read mounted R2 input file');

      const firstExports = await client.beta.files.list({ scope_id: context.session.id });

      assert.equal(
        firstExports.data.length,
        1,
        'Container should export only the real output file and ignore symlinks inside /workspace/outputs',
      );

      const [firstExported] = firstExports.data;

      assert.ok(firstExported !== undefined);
      assert.equal(firstExported.filename, 'report.txt');
      assert.deepEqual(firstExported.scope, { id: context.session.id, type: 'session' });

      const firstDownload = await client.beta.files.download(firstExported.id);

      assert.equal(firstDownload.status, HttpStatusCode.Ok);
      assert.equal(await firstDownload.text(), initialOutputBody);

      // Unchanged output on a follow-up turn must not create a duplicate file.
      await runInstalledBash(context, { command: 'true' });

      const dedupedExports = await client.beta.files.list({ scope_id: context.session.id });

      assert.equal(dedupedExports.data.length, 1, 'Unchanged /workspace/outputs file should be deduplicated');

      // Modifying the output file exports the updated artifact.
      await runInstalledBash(context, {
        command: `printf '%s\\n' 'report-updated-${marker}' > /workspace/outputs/report.txt`,
      });

      const updatedExports = await client.beta.files.list({ scope_id: context.session.id });

      assert.equal(updatedExports.data.length, EXPECTED_EXPORTED_VERSIONS);

      const latest = updatedExports.data.find((entry) => entry.id !== firstExported.id);

      assert.ok(latest !== undefined);

      const latestDownload = await client.beta.files.download(latest.id);

      assert.equal(await latestDownload.text(), updatedOutputBody);

      for (const exported of updatedExports.data) {
        await client.beta.files.delete(exported.id);
      }
    } finally {
      await closeInstalledContext(context).catch((error: unknown) => failures.push(error));
    }
  } catch (error) {
    failures.push(error);
    await stack.captureFailure(marker).catch(() => undefined);
  } finally {
    await client.beta.files.delete(uploadedInput.id).catch((error: unknown) => failures.push(error));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `Installed file mount/export scenario ${marker} failed`, { cause: failures[0] });
  }
}
