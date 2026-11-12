import {
  CONSOLE_STORAGE_READY_TIMEOUT_MS,
  consolePath,
  createAccount,
  createMech,
  requireFixtures,
  sendNotificationAndWait,
  withConsoleBrowser,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const cellCenter = 0.5;

export async function consoleKeepsDraftsAndRunContext({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `console-${randomUUID()}`;
  const first = await createMech({ stack, account, name: marker });
  const second = await createMech({ stack, account, name: `other-${marker}` });

  requireFixtures(stack).model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: `reply-${marker}` } }] },
      { text: 'Private completion' },
    ],
  });

  await sendNotificationAndWait({ stack, account, mechId: first.id, text: marker });

  await withConsoleBrowser({
    stack,
    account,
    run: async (page) => {
      await page.goto(consolePath({ workspaceId: account.workspaceId, mechId: first.id }));
      await page
        .getByText(`reply-${marker}`, { exact: true })
        .first()
        .waitFor({ timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS });

      const draft = page.getByRole('textbox', { name: `Message ${first.name}`, exact: true });

      await draft.fill('Keep this draft');

      const run = page.getByRole('link', { name: 'Open run', exact: true }).first();

      await run.focus();
      await run.click();
      await page.getByRole('button', { name: 'Back to conversation', exact: true }).click();
      assert.equal(await draft.inputValue(), 'Keep this draft');

      await page.getByRole('link', { name: 'Activity', exact: true }).click();
      await page.getByRole('link', { name: 'Runs', exact: true }).click();

      const runRow = page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: `Inspect ${marker}`, exact: true }) });

      const elapsedCell = runRow.getByRole('cell').last();

      await elapsedCell.scrollIntoViewIfNeeded();

      const elapsedBounds = await elapsedCell.boundingBox();

      assert.ok(elapsedBounds !== null);

      const horizontalCenter = elapsedBounds.x + elapsedBounds.width * cellCenter;
      const verticalCenter = elapsedBounds.y + elapsedBounds.height * cellCenter;

      await page.mouse.click(horizontalCenter, verticalCenter);
      await page.getByRole('button', { name: 'Back to runs', exact: true }).click();
      await runRow.getByRole('link').and(page.locator(':focus')).waitFor();

      await page.getByRole('link', { name: 'Conversation', exact: true }).click();
      assert.equal(await draft.inputValue(), 'Keep this draft');

      await page.getByRole('link', { name: 'Mechs', exact: true }).first().click();
      await page.locator(`a[href*="mech=${second.id}"]`).first().click();

      const otherDraft = page.getByRole('textbox', { name: `Message ${second.name}`, exact: true });

      assert.equal(await otherDraft.inputValue(), '');
      await otherDraft.fill('Other draft');
      await page.locator(`a[href*="mech=${first.id}"]`).first().click();
      assert.equal(await draft.inputValue(), 'Keep this draft');
    },
  });
}
