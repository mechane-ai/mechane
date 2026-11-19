import { HttpStatusCode, MediaType } from '@mechane/records';
import {
  CONSOLE_STORAGE_READY_TIMEOUT_MS,
  createManagedContext,
  requireFixtures,
  withConsoleAgent,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { randomUUID } from 'node:crypto';

function sessionPath(id: string): string {
  return `/console-api/v1/sessions/${id}`;
}

export async function consoleRevokesDeniedSession({ stack }: ScenarioInput): Promise<void> {
  const marker = randomUUID();
  const { account, agent, session, client } = await createManagedContext({ stack, name: `Access ${marker}` });
  const text = `Private transcript ${marker}`;
  const { model } = requireFixtures(stack);

  model.configure({ marker: text, replies: [{ text: 'Acknowledged' }] });
  await client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text }] }],
  });
  await withConsoleAgent({
    stack,
    account,
    agentName: agent.name,
    run: async (page) => {
      const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

      await page.getByRole('link', { name: `Open ${session.title ?? session.id}`, exact: true }).click(ready);
      await page.getByText(text, { exact: true }).waitFor(ready);

      function protectedRoute(url: URL): boolean {
        return url.pathname === sessionPath(session.id);
      }

      const peer = await page.context().newPage();

      try {
        await peer.goto(page.url());

        const privateText = peer.getByText(text, { exact: true });

        await privateText.waitFor(ready);
        await page.route(protectedRoute, async (route) => {
          await route.fulfill({
            status: HttpStatusCode.Forbidden,
            contentType: MediaType.Json,
            body: JSON.stringify({
              type: 'error',
              error: { type: 'permission_error', message: 'Session access withdrawn' },
            }),
          });
        });
        await page.reload();
        await page.getByRole('button', { name: 'Try again', exact: true }).waitFor(ready);

        const retry = peer.getByRole('button', { name: 'Try again', exact: true });

        await retry.waitFor(ready);
        await privateText.waitFor({ ...ready, state: 'hidden' });
        await page.unroute(protectedRoute);
        await retry.click();
        await privateText.waitFor(ready);
      } finally {
        await peer.close();
      }
    },
  });
}
