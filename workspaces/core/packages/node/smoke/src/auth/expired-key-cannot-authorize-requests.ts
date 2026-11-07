import { catalog, TYPED_CODE_FIELD } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { approveAndClaimKey, createAccount, startApproval } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { DateTime, Redacted, Schema } from 'effect';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_NAMED_KEY_SECONDS = 31_536_000;
const ErrorResponse = Schema.Struct({ error: Schema.Struct({ code: Schema.String }) });

export async function expiredKeyCannotAuthorizeRequests({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });

  await stack.restart({ environment: { MECHANE_NAMED_KEY_LIFETIME_SECONDS: '2' } });

  try {
    const approval = await startApproval({ stack, name: 'expiring key' });
    const page = await account.browser.request({ url: approval.verificationUrl });
    const review = await account.browser.submit({ page, fields: { [TYPED_CODE_FIELD]: approval.userCode } });

    assert.equal(review.status, HttpStatusCode.Ok);

    const claimed = await approveAndClaimKey({ stack, approval, browser: account.browser, review });

    const expiresAtMillis = DateTime.toEpochMillis(claimed.key.expiresAt);

    await setTimeout(Math.max(0, expiresAtMillis - Date.now() + 1));

    const response = await fetch(new URL(catalog.showPrincipal.path, stack.origin), {
      headers: { [HttpHeader.Authorization]: `Bearer ${Redacted.value(claimed.token)}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const failure = Schema.decodeUnknownSync(ErrorResponse)(await response.json());

    assert.equal(response.status, HttpStatusCode.Unauthorized);
    assert.equal(failure.error.code, 'KeyExpired', 'An expired key still authorized the public API');
  } finally {
    await stack.restart({ environment: { MECHANE_NAMED_KEY_LIFETIME_SECONDS: String(DEFAULT_NAMED_KEY_SECONDS) } });
  }
}
