import { catalog, detailFailure, ErrorBody, KeyPurpose, TYPED_CODE_FIELD } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { FIXTURE_AUTH_RATE_LIMITS } from '@mechane/stack';
import { createAccount, formFields } from '@mechane/testing';
import type { Account, BrowserPage, ScenarioInput } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import assert from 'node:assert/strict';

const LOW_AUTH_LIMITS = {
  ...FIXTURE_AUTH_RATE_LIMITS,
  address: { requests: 4, windowSeconds: 600 },
  codeAttempt: { requests: 3, windowSeconds: 600 },
} as const;

const CLIENT_ADDRESSES = {
  limited: '198.51.100.1',
  other: '198.51.100.2',
  codeAttempts: '198.51.100.3',
  untrustedForwarder: '203.0.113.1',
} as const;

const REQUEST_TIMEOUT_MS = 15_000;
const UNTRUSTED_FORWARDING_HEADER = 'x-forwarded-for';
type CodeAttemptInput = { readonly account: Account; readonly page: BrowserPage };

type DeviceStartInput = {
  readonly stack: ScenarioInput['stack'];
  readonly clientAddress: string;
  readonly forwardedAddress: string;
};

async function wrongCode({ account, page }: CodeAttemptInput): Promise<BrowserPage> {
  return await account.browser.request({
    url: page.url,
    method: HttpMethod.Post,
    headers: { [HttpHeader.Origin]: page.url.origin, [HttpHeader.MechaneClientAddress]: CLIENT_ADDRESSES.codeAttempts },
    body: new URLSearchParams({ ...formFields(page), [TYPED_CODE_FIELD]: 'not-a-device-code' }),
  });
}

async function startDeviceRequest({ stack, clientAddress, forwardedAddress }: DeviceStartInput): Promise<Response> {
  return await fetch(new URL(catalog.startDeviceApproval.path, stack.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.MechaneClientAddress]: clientAddress,
      [UNTRUSTED_FORWARDING_HEADER]: forwardedAddress,
    },
    body: JSON.stringify({ name: 'anonymous limiter smoke', purpose: KeyPurpose.Named }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function assertDeviceRequestAccepted(input: DeviceStartInput): Promise<void> {
  const response = await startDeviceRequest(input);

  assert.equal(response.status, HttpStatusCode.Ok, 'One client address exhausted another address’s allowance');
  Schema.decodeUnknownSync(Schema.fromJsonString(catalog.startDeviceApproval.output))(await response.text());
}

async function assertDeviceRequestLimited(input: DeviceStartInput): Promise<void> {
  const response = await startDeviceRequest(input);

  assert.equal(response.status, HttpStatusCode.TooManyRequests, 'Anonymous device creation evaded its address limit');

  const { error } = Schema.decodeUnknownSync(Schema.fromJsonString(ErrorBody))(await response.text());

  const failure = await Effect.runPromise(
    detailFailure({ detail: error, failures: catalog.startDeviceApproval.errors }),
  );

  assert.equal(failure._tag, 'RateLimited', 'The device-creation refusal is not decodable by the native client');
  assert.ok(failure.retryAfterSeconds > 0);
  assert.equal(response.headers.get(HttpHeader.RetryAfter), String(failure.retryAfterSeconds));
}

export async function authenticationLimitsSurviveRestart({ stack }: ScenarioInput): Promise<void> {
  const ownerLogin = stack.fixtures?.github.users.owner.login;

  assert.ok(ownerLogin !== undefined && ownerLogin.length > 0, 'The limiter smoke requires two admitted identities');

  const owner = await createAccount({ stack, login: ownerLogin });
  const member = await createAccount({ stack });
  const ownerPage = await owner.browser.request({ url: new URL('/device', stack.origin) });
  const memberPage = await member.browser.request({ url: new URL('/device', stack.origin) });

  await stack.restart({
    environment: { MECHANE_AUTH_RATE_LIMITS: JSON.stringify(LOW_AUTH_LIMITS), MECHANE_TRUSTED_PROXY: 'true' },
  });

  try {
    for (let attempt = 0; attempt < LOW_AUTH_LIMITS.address.requests; attempt += 1) {
      await assertDeviceRequestAccepted({
        stack,
        clientAddress: CLIENT_ADDRESSES.limited,
        forwardedAddress: CLIENT_ADDRESSES.untrustedForwarder,
      });
    }

    const limitedClient = { stack, clientAddress: CLIENT_ADDRESSES.limited, forwardedAddress: CLIENT_ADDRESSES.other };

    const otherClient = {
      stack,
      clientAddress: CLIENT_ADDRESSES.other,
      forwardedAddress: CLIENT_ADDRESSES.untrustedForwarder,
    };

    await assertDeviceRequestLimited(limitedClient);
    await assertDeviceRequestAccepted(otherClient);

    const first = await wrongCode({ account: member, page: memberPage });

    assert.equal(first.status, HttpStatusCode.NotFound);

    const limited = await wrongCode({ account: member, page: memberPage });

    assert.equal(limited.status, HttpStatusCode.TooManyRequests, 'Device-code guesses were not bounded');
    assert.ok((limited.headers.get(HttpHeader.RetryAfter) ?? '').length > 0);

    const other = await wrongCode({ account: owner, page: ownerPage });

    assert.equal(
      other.status,
      HttpStatusCode.NotFound,
      'One principal exhausted another principal’s code-attempt allowance',
    );
    await stack.restart();
    await assertDeviceRequestLimited(limitedClient);
    await assertDeviceRequestAccepted(otherClient);

    const retained = await wrongCode({ account: member, page: memberPage });

    assert.equal(retained.status, HttpStatusCode.TooManyRequests, 'Restart discarded the device-code limiter');
  } finally {
    await stack.restart({
      environment: {
        MECHANE_AUTH_RATE_LIMITS: JSON.stringify(FIXTURE_AUTH_RATE_LIMITS),
        MECHANE_TRUSTED_PROXY: 'false',
      },
    });
  }
}
