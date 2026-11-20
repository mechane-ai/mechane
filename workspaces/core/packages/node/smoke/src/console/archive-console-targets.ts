import { CONSOLE_STORAGE_READY_TIMEOUT_MS } from '@mechane/testing';
import type { ConsoleBrowserPage } from '@mechane/testing';

export async function archiveConsoleTargets({
  page,
  agentName,
  sessionTitle,
}: {
  readonly page: ConsoleBrowserPage;
  readonly agentName: string;
  readonly sessionTitle: string;
}): Promise<void> {
  const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };
  const archiveSession = page.getByRole('button', { name: 'Archive session', exact: true });
  const confirmation = page.getByRole('alertdialog');
  const archived = page.getByText('Archived', { exact: true });

  await archiveSession.click(ready);
  await confirmation.getByRole('heading', { name: `Archive ${sessionTitle}?`, exact: true }).waitFor(ready);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await confirmation.waitFor({ ...ready, state: 'hidden' });
  await archiveSession.click();
  await confirmation.getByRole('button', { name: 'Archive session', exact: true }).click();
  await archived.waitFor(ready);
  await page.reload();
  await archived.waitFor(ready);
  await page.getByRole('button', { name: `Back to ${agentName} sessions`, exact: true }).click();
  await page.getByRole('link', { name: 'Open Other session', exact: true }).waitFor(ready);
  await page.getByRole('link', { name: `Open ${sessionTitle}`, exact: true }).waitFor({ ...ready, state: 'hidden' });
  await page.getByRole('button', { name: 'Archive agent', exact: true }).click();
  await confirmation.getByRole('heading', { name: `Archive ${agentName}?`, exact: true }).waitFor(ready);
  await confirmation.getByRole('button', { name: 'Archive agent', exact: true }).click();
  await archived.waitFor(ready);
  await page.getByRole('button', { name: 'Back to agents', exact: true }).click();
  await page.getByRole('button', { name: 'New agent', exact: true }).waitFor(ready);

  const agentLink = page.getByRole('link', { name: `Open ${agentName}`, exact: true });

  await agentLink.waitFor({ ...ready, state: 'hidden' });
  await page.getByRole('button', { name: 'Filter by status' }).click(ready);
  await page.getByRole('menuitem', { name: /Status/u }).click(ready);
  await page.getByRole('menuitemradio', { name: 'Archived', exact: true }).click(ready);
  await agentLink.waitFor(ready);

  await page.getByRole('button', { name: 'Find in view' }).click(ready);

  const search = page.getByRole('searchbox', { name: 'Search agents' });

  await search.fill(`missing-${agentName}`);
  await page.getByText('No matching records.', { exact: true }).waitFor(ready);
  await search.fill(agentName);
  await agentLink.waitFor(ready);
  await page.reload();
  await agentLink.waitFor(ready);
  await search.waitFor(ready);
}
