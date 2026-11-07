import { ApproveForm, DeviceStep } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { createAccount, formFields, pollApproval, startApproval } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';

const REQUEST_TIMEOUT_MS = 15_000;

export async function onlyBrowserCanApproveKeys({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const approval = await startApproval({ stack, name: 'browser approval boundary' });
  const page = await account.browser.request({ url: approval.verificationUrl });
  const fields = formFields(page);
  const csrfToken = fields['csrf_token'];

  assert.ok(
    csrfToken !== undefined && csrfToken.length > 0,
    'The signed-in device page did not include its CSRF token',
  );

  const encoded = Schema.encodeSync(ApproveForm)({ step: DeviceStep.Approve, userCode: approval.userCode, csrfToken });

  const response = await fetch(approval.verificationUrl, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}`, [HttpHeader.Origin]: stack.origin.origin },
    body: new URLSearchParams(encoded),
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await response.arrayBuffer();

  assert.equal(
    response.status,
    HttpStatusCode.Unauthorized,
    'An API key approved another key without the browser session',
  );

  const polled = await pollApproval({ stack, approval });

  assert.equal(polled.status, 'pending');
}
