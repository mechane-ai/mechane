import { CliVariable } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { filesBelow, readPrivateFile, refusedCli, workerLines } from '@mechane/testing';
import type { Account, CliRun, CreatedKey, ScenarioFailure, SearchedText } from '@mechane/testing';
import { Effect, Record } from 'effect';
import { commandOutputs } from './command-outputs.ts';
import { Sentinel } from './constants.ts';

/**
 * Whether the stack's log holds a sentinel, and how many lines the Worker wrote there that decode as log lines and that
 * do not.
 */
type LogFacts = { readonly isSentinelLogged: boolean; readonly decodedLines: number; readonly undecodedLines: number };

/** The texts the token scan reads, and what it finds in the stack's log. */
type ScannedTexts = LogFacts & { readonly texts: ReadonlyArray<SearchedText>; readonly isStorageRead: boolean };

/** The stack's log as text, and what the scan finds in it. */
type ScannedLog = { readonly text: string; readonly logged: LogFacts };

/** The account whose runs the token scan reads, its login's approval and its named key's, and its login key. */
type ScannedTextsInput = {
  readonly stack: Stack;
  readonly account: Account;
  readonly login: CliRun<unknown>;
  readonly named: CreatedKey;
  readonly loginToken: string;
};

type StackInput = { readonly stack: Stack };

/**
 * Every text a token must not appear in: the output of both approvals, of one command of each kind a key makes, and of
 * the logged-out key's refusal. Then every file of the stack's Durable Object storage and its sandboxes' machines, and
 * the celld log with the Worker's, which is also read for the sentinels and non-log lines. The storage counts as read
 * only when it holds the account's GitHub login as text, as an unreadable store would not.
 */
export const scannedTexts = Effect.fn('scannedTexts')(function* ({
  stack,
  account,
  login,
  named,
  loginToken,
}: ScannedTextsInput): Effect.fn.Return<ScannedTexts, ScenarioFailure> {
  const outputs = yield* commandOutputs({ stack, account });

  const refusal = yield* refusedCli({
    stack,
    args: ['auth', 'status'],
    environment: { ...account.environment, [CliVariable.ApiKey]: loginToken },
  });

  const stored = yield* filesBelow({ folder: stack.storageFolder });
  const sandboxes = yield* filesBelow({ folder: stack.sandboxesFolder });
  const { text: log, logged } = yield* scannedLog({ stack });

  const runs = [
    { name: 'the output of mechane auth login', text: login.output },
    { name: 'the output of mechane key create', text: named.output },
    ...outputs,
    { name: 'the output of the refused mechane auth status', text: refusal.output },
  ];

  const isStorageRead = stored.some(({ text }) => text.includes(account.login));

  return { texts: [...runs, ...stored, ...sandboxes, { name: stack.logFile, text: log }], isStorageRead, ...logged };
});

/** The stack's log, whether it holds a sentinel, and how many of the Worker's lines decode as log lines or not. */
const scannedLog = Effect.fn('scannedLog')(function* ({
  stack,
}: StackInput): Effect.fn.Return<ScannedLog, ScenarioFailure> {
  const { text } = yield* readPrivateFile({ path: stack.logFile });
  const { lines, undecodedLines } = workerLines({ text });
  const isSentinelLogged = Record.values(Sentinel).some((sentinel) => text.includes(sentinel));

  return { text, logged: { isSentinelLogged, decodedLines: lines.length, undecodedLines } };
});
