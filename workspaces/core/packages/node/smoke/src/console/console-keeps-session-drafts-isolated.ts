import { HttpMethod } from '@mechane/records';
import {
  CONSOLE_STORAGE_READY_TIMEOUT_MS,
  createManagedContext,
  requireFixtures,
  withConsoleAgent,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function consoleKeepsSessionDraftsIsolated({ stack }: ScenarioInput): Promise<void> {
  const marker = randomUUID();
  const { account, agent, client, environment, session } = await createManagedContext({ stack, name: marker });

  const other = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environment.id,
    title: 'Other session',
  });

  const { model } = requireFixtures(stack);
  const hold = `Hold ${marker}`;
  const draft = `Draft ${marker}`;

  model.configure({ marker: hold, replies: [{ text: hold, isHeld: true }] });
  model.configure({ marker: draft, replies: [{ text: `Received ${marker}` }] });

  try {
    await withConsoleAgent({
      stack,
      account,
      agentName: agent.name,
      run: async (page) => {
        const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

        const firstRow = page.getByRole('link', { name: `Open ${session.title ?? session.id}`, exact: true });

        await firstRow.click(ready);

        const composer = page.getByRole('textbox', { name: 'Message this session', exact: true });

        await composer.fill(draft);

        const firstUrl = page.url();

        await client.beta.sessions.events.send(other.id, {
          events: [{ type: 'user.message', content: [{ type: 'text', text: hold }] }],
        });
        await model.waitForCall({ marker: hold, index: 0 });
        await page.getByRole('button', { name: `Back to ${agent.name} sessions`, exact: true }).click();

        const working = page.getByRole('row').filter({ hasText: 'Working now' });

        await working.getByRole('link', { name: 'Open Other session', exact: true }).click(ready);
        await composer.waitFor(ready);
        assert.equal(await composer.inputValue(), '');
        await composer.fill('A different draft');

        await page.goBack();
        await firstRow.click(ready);
        await composer.waitFor(ready);
        assert.equal(page.url(), firstUrl);
        assert.equal(await composer.inputValue(), draft);

        const active = page.getByRole('button', { name: 'Agent working in another session', exact: true });

        await active.click(ready);
        await composer.waitFor(ready);
        assert.equal(await composer.inputValue(), 'A different draft');
        await page.goBack();
        await composer.waitFor(ready);
        assert.equal(await composer.inputValue(), draft);
        model.release({ marker: hold, index: 0 });

        const [receipt] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.request().method() === HttpMethod.Post && new URL(response.url()).pathname.endsWith('/events'),
            ready,
          ),
          composer.press('Enter'),
        ]);

        assert.ok(receipt.ok(), 'The session rejected its own draft');

        const request = receipt.request();

        assert.equal(await request.headerValue('authorization'), null);
        assert.equal(await request.headerValue('x-api-key'), null);
        assert.equal(await request.headerValue('x-mechane-browser-authentication'), '1');

        const history = await client.beta.sessions.events.list(other.id, { types: ['user.message'] });

        assert.ok(
          !history.data.some(
            (event) =>
              event.type === 'user.message' &&
              event.content.some((block) => block.type === 'text' && block.text === draft),
          ),
        );
        await page.reload();
        await page.getByText(`Received ${marker}`, { exact: true }).waitFor(ready);
        assert.equal(page.url(), firstUrl);
      },
    });
  } finally {
    model.release({ marker: hold, index: 0 });
  }
}
