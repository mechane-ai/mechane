import { BROWSER_VIEWPORT_HEIGHT, BROWSER_VIEWPORT_WIDTH } from '@mechane/sandbox-wire';
import { DateTime, Duration, Effect, Option } from 'effect';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserChild, BrowserChildren } from './browser-process.ts';
import { runBrowserChild, startBrowserChild } from './browser-process.ts';
import type { DevtoolsConnection } from './devtools.ts';
import { connectDevtools } from './devtools.ts';
import { BrowserFailed, BrowserFailureKind } from './errors.ts';
import type { BrowserSettings } from './types.ts';

const START_TIMEOUT = Duration.seconds(20);
const START_POLL = Duration.millis(50);

/** Holds the private display and Chromium transport shared by one guest browser runtime. */
export type ChromiumSession = {
  readonly connection: DevtoolsConnection;
  readonly environment: Readonly<Record<string, string>>;
};

type StartChromiumInput = { readonly settings: BrowserSettings; readonly children: BrowserChildren };

/** Launches a private display and Chromium profile with guest-owned children and no ambient home directory. */
export const startChromium = Effect.fn('startChromium')(function* ({
  settings,
  children,
}: StartChromiumInput): Effect.fn.Return<ChromiumSession, BrowserFailed> {
  const privateHome = join(settings.scratchDirectory, 'home');
  const profile = join(settings.scratchDirectory, 'profile');
  const temporary = join(settings.scratchDirectory, 'tmp');

  yield* Effect.tryPromise({
    try: () => mkdir(temporary, { recursive: true, mode: 0o700 }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Process, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => mkdir(privateHome, { recursive: true, mode: 0o700 }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Process, reason: String(cause) }),
  });

  const environment = { PATH: settings.path, HOME: privateHome, TMPDIR: temporary };

  if (Option.isSome(settings.certificateFile)) {
    const certificateDatabase = join(privateHome, '.pki', 'nssdb');

    yield* Effect.tryPromise({
      try: () => mkdir(certificateDatabase, { recursive: true, mode: 0o700 }),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Process, reason: String(cause) }),
    });
    yield* runBrowserChild({
      command: 'certutil',
      args: ['-N', '--empty-password', '-d', `sql:${certificateDatabase}`],
      environment,
      children,
      timeout: START_TIMEOUT,
    });
    yield* runBrowserChild({
      command: 'certutil',
      args: [
        '-A',
        '-n',
        'Mechane gateway',
        '-t',
        'C,,',
        '-i',
        settings.certificateFile.value,
        '-d',
        `sql:${certificateDatabase}`,
      ],
      environment,
      children,
      timeout: START_TIMEOUT,
    });
  }

  const display = yield* startBrowserChild({
    command: settings.displayExecutable,
    args: [
      '-displayfd',
      '1',
      '-screen',
      '0',
      `${BROWSER_VIEWPORT_WIDTH}x${BROWSER_VIEWPORT_HEIGHT}x24`,
      '-nolisten',
      'tcp',
    ],
    environment,
    children,
  });

  const displayNumber = yield* awaitProcessOutput({ running: display, pattern: /^(\d+)\s*$/m, name: 'Xvfb display' });
  const browserEnvironment = { ...environment, DISPLAY: `:${displayNumber}` };

  const args = [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--password-store=basic',
    '--disable-background-networking',
    '--disable-session-crashed-bubble',
    `--window-size=${BROWSER_VIEWPORT_WIDTH},${BROWSER_VIEWPORT_HEIGHT}`,
    'about:blank',
  ];

  if (settings.isSandboxDisabled) {
    args.push('--no-sandbox');
  }

  const browser = yield* startBrowserChild({
    command: settings.chromiumExecutable,
    args,
    environment: browserEnvironment,
    children,
  });

  const websocketUrl = yield* awaitProcessOutput({
    running: browser,
    pattern: /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/,
    name: 'Chromium debugging socket',
  });

  const connection = yield* connectDevtools({ websocketUrl });

  return { connection, environment: browserEnvironment };
});

type AwaitProcessOutputInput = { readonly running: BrowserChild; readonly pattern: RegExp; readonly name: string };

const awaitProcessOutput = Effect.fn('awaitProcessOutput')(function* ({
  running,
  pattern,
  name,
}: AwaitProcessOutputInput): Effect.fn.Return<string, BrowserFailed> {
  const startedAt = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(startedAt, START_TIMEOUT);

  const isBeforeDeadline: () => boolean = () => {
    const now = DateTime.nowUnsafe();

    return DateTime.isLessThan(now, deadline);
  };

  while (isBeforeDeadline()) {
    const output = `${running.stdout()}\n${running.stderr()}`;
    const matched = pattern.exec(output);
    const found = Option.fromNullishOr(matched);
    const value = Option.flatMap(found, (match) => Option.fromNullishOr(match[1]));

    if (Option.isSome(value)) {
      return value.value;
    }

    const exitCode = Option.fromNullishOr(running.child.exitCode);
    const signalCode = Option.fromNullishOr(running.child.signalCode);

    if (Option.isSome(exitCode) || Option.isSome(signalCode)) {
      const error = running.stderr();

      return yield* new BrowserFailed({
        kind: BrowserFailureKind.Process,
        reason: `${name} exited before readiness: ${error}`,
      });
    }

    yield* Effect.sleep(START_POLL);
  }

  return yield* new BrowserFailed({
    kind: BrowserFailureKind.Process,
    reason: `${name} did not become ready before its deadline`,
  });
});
