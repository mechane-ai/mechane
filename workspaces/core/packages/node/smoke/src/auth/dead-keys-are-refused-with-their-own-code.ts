import { CliVariable } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { check, createdKey, RefusalCode, refusedCli, runCli, savedLoginToken, signedInAccount } from '@mechane/testing';
import type { Account, CliRefusal, ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { DateTime, Duration, Effect, Schema } from 'effect';
import { ScenarioKey } from './constants.ts';

/** How long past a key's expiry a scenario waits before it presents the key, so the clocks agree it expired. */
const EXPIRY_MARGIN = Duration.millis(500);

/** A key a scenario presents to the CLI as the API key variable, for an account of the stack. */
type PresentedTokenInput = { readonly stack: Stack; readonly account: Account; readonly token: string };

/**
 * Signs in, creates an expiring key and logs out; the logged-out login key and then the expired key are each presented
 * to `auth status`.
 */
export const deadKeysAreRefusedWithTheirOwnCode = Effect.fn('deadKeysAreRefusedWithTheirOwnCode')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const account = yield* signedInAccount({ stack });
  const { environment } = account;
  const login = yield* savedLoginToken({ account });
  const expiring = yield* createdKey({ stack, account, name: ScenarioKey.Expiring, presentedKeys: [] });

  yield* runCli({ stack, args: ['auth', 'logout'], environment, result: Schema.Unknown });

  const loggedOut = yield* statusRefusal({ stack, account, token: login.token });
  const expiresIn = DateTime.distance(DateTime.nowUnsafe(), expiring.key.expiresAt);

  yield* Effect.sleep(Duration.sum(Duration.max(expiresIn, Duration.zero), EXPIRY_MARGIN));

  const expired = yield* statusRefusal({ stack, account, token: expiring.token });

  yield* check({
    name: guarantee,
    conditions: [loggedOut.code === RefusalCode.Revoked, expired.code === RefusalCode.Expired],
    detail: `the logged-out login key got ${loggedOut.code}, and the expired key ${expired.code}`,
  });
});

/** Runs `auth status` with the key as the API key variable, which the scenario expects the deployment to refuse. */
const statusRefusal = Effect.fn('statusRefusal')(function* ({
  stack,
  account,
  token,
}: PresentedTokenInput): Effect.fn.Return<CliRefusal, ScenarioFailure> {
  return yield* refusedCli({
    stack,
    args: ['auth', 'status'],
    environment: { ...account.environment, [CliVariable.ApiKey]: token },
  });
});
