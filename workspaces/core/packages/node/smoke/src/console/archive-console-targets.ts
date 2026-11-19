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
  await page.getByRole('link', { name: `Open ${agentName}`, exact: true }).waitFor({ ...ready, state: 'hidden' });
}
