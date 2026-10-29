import { SandboxReport } from '@mechane/protocol';
import { startCloudflareStack } from '@mechane/stack';
import { check, refusedCli, runCli, signedInMech } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';

const expectedState = 'suspended';
const expectedImage = 'fixture-previous-image';
const desiredImage = 'fixture-next-image';
const expectedRefusal = 'ObjectUnavailable';
const redirectRequests = 2;

/** Real workerd must accept provider fetch options and refuse redirects before a provider credential can follow. */
export const cloudflareServesSandboxInspection = Effect.fn('cloudflareServesSandboxInspection')(function* ({
  stack: local,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const stack = yield* startCloudflareStack({ settings: local.settings });
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const account = mech.account;

  const args = ['sandbox', 'show', mech.id];
  const shown = yield* runCli({ stack, environment: account.environment, args, result: SandboxReport });
  const firstRequests = stack.provider.requests();
  const hasExpectedImage = Option.contains(shown.result.image, expectedImage);

  yield* check({
    name: guarantee,
    conditions: [
      shown.result.status === expectedState,
      hasExpectedImage,
      shown.result.desiredImage === desiredImage,
      firstRequests.length === 1,
    ],
    detail: `sandbox ${shown.result.status}`,
  });

  stack.provider.redirect();

  const refused = yield* refusedCli({ stack, environment: account.environment, args });
  const finalRequests = stack.provider.requests();

  yield* check({
    name: guarantee,
    conditions: [refused.code === expectedRefusal, finalRequests.length === redirectRequests],
    detail: `redirect answered ${refused.code}`,
  });
}, Effect.scoped);
