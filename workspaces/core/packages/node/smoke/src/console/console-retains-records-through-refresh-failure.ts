import { HttpStatusCode, MediaType } from '@mechane/records';
import { consolePath, createAccount, createMech, mechPath, withConsoleBrowser } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
      const path = mechPath({ account, mechId: mech.id });
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
    },
  });
}
