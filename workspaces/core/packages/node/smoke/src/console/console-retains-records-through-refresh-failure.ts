import { catalog } from '@mechane/protocol';
import { HttpStatusCode, MediaType } from '@mechane/records';
import {
  CONSOLE_STORAGE_READY_TIMEOUT_MS,
  consolePath,
  createAccount,
  createMech,
  mechPath,
  requireFixtures,
  withConsoleBrowser,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

type EnvironmentPathInput = { readonly workspaceId: string; readonly mechId: string };

export async function consoleRetainsRecordsThroughRefreshFailure({ stack }: ScenarioInput): Promise<void> {
  const login = requireFixtures(stack).github.users.owner.login;
  const account = await createAccount({ stack, login });
  const mech = await createMech({ stack, account, name: `warm-${randomUUID()}` });

  await withConsoleBrowser({
    stack,
    account,
    run: async (page) => {
      const storageReady = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

      await page.goto(consolePath({ workspaceId: account.workspaceId, mechId: mech.id }));

      const composer = page.getByRole('textbox', { name: `Message ${mech.name}`, exact: true });

      await composer.waitFor(storageReady);

      const shortcut = page.getByRole('link', { name: mech.name, exact: true });

      await shortcut.waitFor(storageReady);

      const path = mechPath({ account, mechId: mech.id });
      const environment = environmentPath({ workspaceId: account.workspaceId, mechId: mech.id });
      const environmentUrl = new URL(environment, stack.origin).href;
      const environmentResponse = page.waitForResponse((response) => response.url() === environmentUrl, storageReady);

      const [overviewResponse] = await Promise.all([
        environmentResponse,
        page.getByRole('link', { name: 'Environment', exact: true }).click(),
      ]);

      assert.equal(overviewResponse.status(), HttpStatusCode.Ok, `Environment GET ${environmentUrl} did not succeed`);

      const body: unknown = await overviewResponse.json();
      const overview = Schema.decodeUnknownSync(catalog.showEnvironment.output)(body);
      const savedFiles = page.getByRole('heading', { name: 'Saved files', exact: true });

      await savedFiles.waitFor(storageReady);
      assert.equal(Option.getOrThrow(overview.environment.processes).length, 0);
      assert.equal(Option.isNone(overview.sandboxId), true, 'Passive inspection allocated a machine');

      // Visible rows can precede persistence acceptance; establish a completed native read before reloading.
      await page.getByRole('link', { name: `Settings for ${account.login}`, exact: true }).click();
      await page.getByRole('button', { name: 'Data status', exact: true }).click();

      const refreshingReads = page
        .locator('dl > div')
        .filter({ has: page.getByText('Refreshing', { exact: true }) })
        .getByRole('definition');

      await refreshingReads.filter({ hasText: /^0$/ }).waitFor(storageReady);
      await page
        .locator('dl > div')
        .filter({ has: page.getByText('Failed reads', { exact: true }) })
        .getByRole('definition')
        .filter({ hasText: /^0$/ })
        .waitFor(storageReady);
      await page.getByText('wa-sqlite / OPFS available', { exact: true }).waitFor(storageReady);
      await shortcut.click();
      await composer.waitFor(storageReady);

      const gate = Promise.withResolvers<void>();
      const pattern = new URL(path, stack.origin).href;

      await page.route(pattern, async (route) => {
        await gate.promise;
        await route.fulfill({ status: HttpStatusCode.Unavailable, contentType: MediaType.Json, body: '{}' });
      });

      try {
        const pending = page.waitForRequest((request) => request.url() === pattern, storageReady);

        const [, request] = await Promise.all([page.reload(), pending]);

        await Promise.race([
          composer.waitFor(storageReady),
          request.response().then(() => {
            throw new Error('The held refresh finished before durable content appeared');
          }),
        ]);
        assert.equal(await composer.isEnabled(), true);

        const failed = page.waitForResponse(
          (response) => response.status() === HttpStatusCode.Unavailable && response.url() === pattern,
          storageReady,
        );

        gate.resolve();
        await failed;
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor(storageReady);
        assert.equal(await composer.isEnabled(), true);
      } finally {
        gate.resolve();
        await page.unrouteAll({ behavior: 'wait' });
      }

      await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
      await page
        .getByRole('button', { name: 'Retry refresh', exact: true })
        .waitFor({ ...storageReady, state: 'hidden' });
      await page.getByRole('link', { name: 'Environment', exact: true }).click();
      await savedFiles.waitFor(storageReady);
      await page.route(environmentUrl, (route) =>
        route.fulfill({ status: HttpStatusCode.Unavailable, contentType: MediaType.Json, body: '{}' }),
      );

      try {
        await page.reload();
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor(storageReady);
        assert.equal(await savedFiles.isVisible(), true, 'Failed refresh hid the retained environment overview');
      } finally {
        await page.unroute(environmentUrl);
      }

      const refreshed = page.waitForResponse(
        (response) => response.url() === environmentUrl && response.status() === HttpStatusCode.Ok,
        storageReady,
      );

      const [refreshedResponse] = await Promise.all([
        refreshed,
        page.getByRole('button', { name: 'Retry refresh', exact: true }).click(),
      ]);

      const refreshedBody: unknown = await refreshedResponse.json();
      const recovered = Schema.decodeUnknownSync(catalog.showEnvironment.output)(refreshedBody);

      assert.equal(Option.isNone(recovered.sandboxId), true, 'Refreshing the overview allocated a machine');
      await savedFiles.waitFor(storageReady);
      await page
        .getByRole('button', { name: 'Retry refresh', exact: true })
        .waitFor({ ...storageReady, state: 'hidden' });
    },
  });
}

function environmentPath({ workspaceId, mechId }: EnvironmentPathInput): string {
  const workspace = encodeURIComponent(workspaceId);
  const mech = encodeURIComponent(mechId);
  const path = catalog.showEnvironment.path.replace(':workspace_id', workspace);

  return path.replace(':mech_id', mech);
}
