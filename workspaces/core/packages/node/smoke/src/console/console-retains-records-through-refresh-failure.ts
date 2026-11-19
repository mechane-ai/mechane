import { HttpStatusCode, MediaType } from '@mechane/records';
import { CONSOLE_STORAGE_READY_TIMEOUT_MS, createManagedContext, withConsoleAgent } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function consoleRetainsRecordsThroughRefreshFailure({ stack }: ScenarioInput): Promise<void> {
  const { account, agent, session } = await createManagedContext({ stack, name: `Refresh ${randomUUID()}` });

  await withConsoleAgent({
    stack,
    account,
    agentName: agent.name,
    run: async (page) => {
      const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

      const row = page.getByRole('link', { name: `Open ${session.title ?? session.id}`, exact: true });

      await row.waitFor(ready);

      const listUrl = page.url();

      await page.getByRole('link', { name: `Settings for ${account.login}`, exact: true }).click();
      await page.getByRole('button', { name: 'Data status', exact: true }).click();
      await page.getByText('wa-sqlite / OPFS available', { exact: true }).waitFor(ready);

      for (const label of ['Refreshing', 'Failed reads']) {
        await page
          .locator('dl > div')
          .filter({ has: page.getByText(label, { exact: true }) })
          .getByRole('definition')
          .filter({ hasText: /^0$/ })
          .waitFor(ready);
      }

      const gate = Promise.withResolvers<void>();

      function isSessionList(url: URL): boolean {
        return url.pathname === '/console-api/v1/sessions' && url.searchParams.get('agent_id') === agent.id;
      }

      await page.route(isSessionList, async (route) => {
        await gate.promise;
        await route.fulfill({
          status: HttpStatusCode.Unavailable,
          contentType: MediaType.Json,
          body: JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Session refresh failed' } }),
        });
      });

      const retry = page.getByRole('button', { name: 'Retry refresh', exact: true });

      try {
        const pending = page.waitForRequest((request) => isSessionList(new URL(request.url())), ready);
        const [, request] = await Promise.all([page.goto(listUrl), pending]);

        await Promise.race([
          row.waitFor(ready),
          request.response().then(() => {
            throw new Error('The refresh finished before persisted session metadata appeared');
          }),
        ]);
        gate.resolve();
        await retry.waitFor(ready);
        assert.equal(await row.isVisible(), true);
      } finally {
        gate.resolve();
        await page.unrouteAll({ behavior: 'wait' });
      }

      const [refreshed] = await Promise.all([
        page.waitForResponse((response) => isSessionList(new URL(response.url())) && response.ok(), ready),
        retry.click(),
      ]);

      assert.equal(refreshed.status(), HttpStatusCode.Ok);
      await retry.waitFor({ ...ready, state: 'hidden' });
      await row.click();
      await page.getByRole('textbox', { name: 'Message this session', exact: true }).waitFor(ready);
    },
  });
}
