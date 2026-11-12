import { writeDiagnostic } from '@mechane/program';
import type { LocalStack } from '@mechane/stack';
import { Duration } from 'effect';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { Account } from './auth/types.ts';

type ConsoleBrowserInput = {
  readonly stack: LocalStack;
  readonly account: Account;
  readonly run: (page: Page) => Promise<void>;
};

const BROWSER_TIMEOUT_MS = 15_000;
// Native cache opening allows 30 seconds, followed by an operation's 45-second leader handoff budget.
export const CONSOLE_STORAGE_READY_TIMEOUT_MS = Duration.toMillis('75 seconds');
const CAPTURE_TIMEOUT_MS = 5000;
const NETWORK_MAX_EVENTS = 100;
const PRIVATE_FILE_MODE = 0o600;
const NETWORK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

type BrowserNetworkEvent = {
  readonly kind: 'request' | 'response' | 'failed';
  readonly method: string;
  readonly url: string;
  readonly status?: number;
  readonly failure?: string;
};

type CaptureBrowserFailureInput = { readonly page: Page; readonly network: ReadonlyArray<BrowserNetworkEvent> };

function safeBrowserUrl(value: string): string {
  const url = new URL(value);

  if (!NETWORK_PROTOCOLS.has(url.protocol)) {
    return url.protocol;
  }

  return `${url.origin}${url.pathname}`;
}

async function captureBrowserFailure({ page, network }: CaptureBrowserFailureInput): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'mechane-console-failure-'));
  const screenshot = join(directory, 'page.png');

  const evidence = {
    ownerPid: process.pid,
    capturedAt: new Date().toISOString(),
    url: safeBrowserUrl(page.url()),
    network,
  };

  await Promise.allSettled([
    writeFile(join(directory, 'network.json'), JSON.stringify(evidence), { mode: PRIVATE_FILE_MODE }),
    page
      .screenshot({
        path: screenshot,
        mask: [page.locator('input, textarea, [contenteditable], pre, code')],
        timeout: CAPTURE_TIMEOUT_MS,
      })
      .then(() => chmod(screenshot, PRIVATE_FILE_MODE)),
  ]);
  writeDiagnostic({ program: 'console-browser', line: `Failure evidence: ${directory}` });
}

/** Exercises the compiled Console with its own browser session and native Worker storage. */
export async function withConsoleBrowser({ stack, account, run }: ConsoleBrowserInput): Promise<void> {
  const network: Array<BrowserNetworkEvent> = [];

  function record(event: BrowserNetworkEvent): void {
    network.push(event);

    if (network.length > NETWORK_MAX_EVENTS) {
      network.shift();
    }
  }

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ baseURL: stack.origin.origin });
    const page = await context.newPage();

    page.on('request', (request) =>
      record({ kind: 'request', method: request.method(), url: safeBrowserUrl(request.url()) }),
    );
    page.on('response', (response) =>
      record({
        kind: 'response',
        method: response.request().method(),
        url: safeBrowserUrl(response.url()),
        status: response.status(),
      }),
    );
    page.on('requestfailed', (request) =>
      record({
        kind: 'failed',
        method: request.method(),
        url: safeBrowserUrl(request.url()),
        failure: request.failure()?.errorText ?? 'unavailable',
      }),
    );

    page.setDefaultTimeout(BROWSER_TIMEOUT_MS);

    const signIn = new URL('/auth/sign-in', stack.origin);

    try {
      signIn.searchParams.set('returnTo', '/device');
      await page.goto(signIn.href);
      await page.getByLabel('GitHub account').selectOption(account.login);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL((url) => url.origin === stack.origin.origin && url.pathname === '/device');
      await run(page);
    } catch (cause) {
      await captureBrowserFailure({ page, network }).catch(() => undefined);

      throw cause;
    }
  } finally {
    await browser.close();
  }
}
