import { CONSOLE_STORAGE_READY_TIMEOUT_MS, withConsoleBrowser } from './with-console-browser.ts';

type Input = Parameters<typeof withConsoleBrowser>[0] & { readonly agentName: string };

/** Opens the agent from the workspace directory in the signed-in user's browser. */
export async function withConsoleAgent({ stack, account, agentName, run }: Input): Promise<void> {
  await withConsoleBrowser({
    stack,
    account,
    run: async (page) => {
      const directory = new URL('/console/', stack.origin);

      directory.searchParams.set('workspace', stack.bootstrapWorkspaceId);
      await page.goto(directory.href);
      await page
        .getByRole('link', { name: `Open ${agentName}`, exact: true })
        .click({ timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS });
      await run(page);
    },
  });
}
