import { catalog, EnvironmentOverview } from '@mechane/protocol';
import { HttpStatusCode, MediaType } from '@mechane/records';
import { consolePath, createAccount, createMech, mechPath, withConsoleBrowser } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

type EnvironmentPathInput = { readonly workspaceId: string; readonly mechId: string };

export async function consoleRetainsRecordsThroughRefreshFailure({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const mech = await createMech({ stack, account, name: `warm-${randomUUID()}` });

  await withConsoleBrowser({
    stack,
    account,
    run: async (page) => {
      await page.goto(consolePath({ workspaceId: account.workspaceId, mechId: mech.id }));

      const composer = page.getByRole('textbox', { name: `Message ${mech.name}`, exact: true });

      await composer.waitFor();

      const shortcut = page.getByRole('link', { name: mech.name, exact: true });

      await shortcut.waitFor();

      const path = mechPath({ account, mechId: mech.id });
      const environment = environmentPath({ workspaceId: account.workspaceId, mechId: mech.id });
      const environmentUrl = new URL(environment, stack.origin).href;
      const environmentResponse = page.waitForResponse((response) => response.url() === environmentUrl);

      await page.getByRole('link', { name: 'Environment', exact: true }).click();

      const overviewResponse = await environmentResponse;
      const body: unknown = await overviewResponse.json();
      const overview = Schema.decodeUnknownSync(EnvironmentOverview)(body);
      const savedFiles = page.getByRole('heading', { name: 'Saved files', exact: true });

      await savedFiles.waitFor();
      assert.equal(overview.processes.length, 0);
      assert.equal(Option.isNone(overview.sandbox.sandboxId), true, 'Passive inspection allocated a machine');

      // Visible rows can precede persistence acceptance; establish a completed native read before reloading.
      await page.getByRole('link', { name: `Settings for ${account.login}`, exact: true }).click();
      await page.getByRole('button', { name: 'Data status', exact: true }).click();

      const refreshingReads = page
        .locator('dl > div')
        .filter({ has: page.getByText('Refreshing', { exact: true }) })
        .getByRole('definition');

      await refreshingReads.filter({ hasText: /^0$/ }).waitFor();
      await page.getByText('wa-sqlite / OPFS available', { exact: true }).waitFor();
      await shortcut.click();
      await composer.waitFor();

      const gate = Promise.withResolvers<void>();
      const pattern = new URL(path, stack.origin).href;

      await page.route(pattern, async (route) => {
        await gate.promise;
        await route.fulfill({ status: HttpStatusCode.Unavailable, contentType: MediaType.Json, body: '{}' });
      });

      try {
        const pending = page.waitForRequest((request) => request.url() === pattern);

        await page.reload();

        const request = await pending;

        await Promise.race([
          composer.waitFor(),
          request.response().then(() => {
            throw new Error('The held refresh finished before durable content appeared');
          }),
        ]);
        assert.equal(await composer.isEnabled(), true);

        const failed = page.waitForResponse(
          (response) => response.status() === HttpStatusCode.Unavailable && response.url() === pattern,
        );

        gate.resolve();
        await failed;
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor();
        assert.equal(await composer.isEnabled(), true);
      } finally {
        gate.resolve();
        await page.unrouteAll({ behavior: 'wait' });
      }

      await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
      await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('link', { name: 'Environment', exact: true }).click();
      await savedFiles.waitFor();
      await page.route(environmentUrl, (route) =>
        route.fulfill({ status: HttpStatusCode.Unavailable, contentType: MediaType.Json, body: '{}' }),
      );

      try {
        await page.reload();
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor();
        assert.equal(await savedFiles.isVisible(), true, 'Failed refresh hid the retained environment overview');
      } finally {
        await page.unroute(environmentUrl);
      }

      const refreshed = page.waitForResponse(
        (response) => response.url() === environmentUrl && response.status() === HttpStatusCode.Ok,
      );

      await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();

      const refreshedResponse = await refreshed;
      const refreshedBody: unknown = await refreshedResponse.json();
      const recovered = Schema.decodeUnknownSync(EnvironmentOverview)(refreshedBody);

      assert.equal(Option.isNone(recovered.sandbox.sandboxId), true, 'Refreshing the overview allocated a machine');
      await savedFiles.waitFor();
      await page.getByRole('button', { name: 'Retry refresh', exact: true }).waitFor({ state: 'hidden' });
    },
  });
}

function environmentPath({ workspaceId, mechId }: EnvironmentPathInput): string {
  const workspace = encodeURIComponent(workspaceId);
  const mech = encodeURIComponent(mechId);
  const path = catalog.showEnvironment.path.replace(':workspace_id', workspace);

  return path.replace(':mech_id', mech);
}
