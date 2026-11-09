import type { LocalStack } from '@mechane/stack';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { Account } from './auth/types.ts';

type ConsoleBrowserInput = {
  readonly stack: LocalStack;
  readonly account: Account;
  readonly run: (page: Page) => Promise<void>;
};

const BROWSER_TIMEOUT_MS = 15_000;

/** Exercises the compiled Console with its own browser session and native Worker storage. */
export async function withConsoleBrowser({ stack, account, run }: ConsoleBrowserInput): Promise<void> {
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ baseURL: stack.origin.origin });
    const page = await context.newPage();

    page.setDefaultTimeout(BROWSER_TIMEOUT_MS);

    const signIn = new URL('/auth/sign-in', stack.origin);

    signIn.searchParams.set('returnTo', '/device');
    await page.goto(signIn.href);
    await page.getByLabel('GitHub account').selectOption(account.login);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL((url) => url.origin === stack.origin.origin && url.pathname === '/device');
    await run(page);
  } finally {
    await browser.close();
  }
}
