import type { Stack } from '@mechane/stack';
import { approvedCli, check, createdKey, freshAccount, savedLoginToken, SignedIn, tokenLeaks } from '@mechane/testing';
import type { CreatedKey, PrivateToken, ScenarioFailure, ScenarioInput, SearchedText } from '@mechane/testing';
import { Effect, Option } from 'effect';
import { ScenarioKey } from './constants.ts';
import { scannedTexts } from './scanned-texts.ts';
import { sentinelTurns } from './sentinel-turns.ts';

/** The credential texts the token scan must recognize: the saved login, the named key, and the stack's two secrets. */
const RECOGNIZED_CREDENTIALS = 4;

/** The saved login and the named key whose texts the scan must recognize, and the stack that staged its secrets. */
type CredentialTextsInput = { readonly stack: Stack; readonly saved: PrivateToken; readonly named: CreatedKey };

/**
 * Signs in, creates a named key, and gives a mech a sentinel text and a command that its sandbox runs; then reads every
 * text a token could reach. The log holds neither sentinel, and each line the Worker wrote there is a log line.
 */
export const tokensStayInTheirCredentialFiles = Effect.fn('tokensStayInTheirCredentialFiles')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const account = yield* freshAccount({ stack });
  const login = yield* approvedCli({ stack, args: ['auth', 'login'], account, result: SignedIn });
  const saved = yield* savedLoginToken({ account });
  const named = yield* createdKey({ stack, account, name: ScenarioKey.Sentinel, presentedKeys: [] });
  const isCommandRun = yield* sentinelTurns({ stack, account });
  const scanned = yield* scannedTexts({ stack, account, login, named, loginToken: saved.token });
  const { texts, isStorageRead, isSentinelLogged, decodedLines, undecodedLines } = scanned;
  const secrets = [stack.modelUpstream.apiKey, ...Option.toArray(stack.launcherKey)];
  const leaks = tokenLeaks({ texts, secrets });
  const held = tokenLeaks({ texts: credentialTexts({ stack, saved, named }), secrets });
  const isEveryTokenFound = held.length === RECOGNIZED_CREDENTIALS;
  const isLogWellFormed = decodedLines > 0 && undecodedLines === 0;
  const isLogClean = isCommandRun && !isSentinelLogged && isLogWellFormed;

  yield* check({
    name: guarantee,
    conditions: [leaks.length === 0, isEveryTokenFound, isStorageRead, saved.isPrivate, named.isPrivate, isLogClean],
    detail: `a token in ${leaks.join(', ')}; recognized in ${held.join(', ')}; storage read: ${isStorageRead}; private: ${saved.isPrivate}, ${named.isPrivate}; the sentinel command ran: ${isCommandRun}; a sentinel logged: ${isSentinelLogged}; ${decodedLines} log lines and ${undecodedLines} Worker lines that are no log line`,
  });
});

/**
 * The texts that hold a credential, each of which the scan must recognize: the saved login, the named key's file, and
 * the secrets the stack staged.
 */
function credentialTexts({ stack, saved, named }: CredentialTextsInput): ReadonlyArray<SearchedText> {
  return [
    { name: 'the saved login', text: saved.token },
    { name: 'the named key file', text: named.token },
    { name: 'the model upstream key the stack staged', text: stack.modelUpstream.apiKey },
    ...Option.toArray(stack.launcherKey).map((text) => ({ name: 'the host launcher key the stack staged', text })),
  ];
}
