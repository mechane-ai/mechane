import { DeviceStep, TYPED_CODE_FIELD } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { approveAndClaimKey, createAccount, formFields, pollApproval, startApproval } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';

export async function deviceApprovalRequiresTypedCodeAndCsrf({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const approval = await startApproval({ stack, name: 'typed device approval' });
  const link = new URL(approval.verificationUrl);

  link.searchParams.set('code', approval.userCode);

  const opened = await account.browser.request({ url: link });
  const fields = formFields(opened);

  assert.equal(fields['step'], 'review', 'A code in a link bypassed the typed-code step');
  assert.equal(fields['user_code'], undefined, 'The query code was copied into an approval form');
  assert.equal(opened.text.includes(approval.userCode), false, 'The linked code was prefilled instead of typed');

  const withoutCsrf = await account.browser.request({
    url: approval.verificationUrl,
    method: HttpMethod.Post,
    headers: { [HttpHeader.Origin]: stack.origin.origin },
    body: new URLSearchParams({ step: DeviceStep.Review, [TYPED_CODE_FIELD]: approval.userCode }),
  });

  assert.equal(
    withoutCsrf.status,
    HttpStatusCode.BadRequest,
    'The device endpoint accepted a form without its CSRF token',
  );

  const pending = await pollApproval({ stack, approval });

  assert.equal(pending.status, 'pending');

  const review = await account.browser.submit({ page: opened, fields: { [TYPED_CODE_FIELD]: approval.userCode } });

  assert.equal(review.status, HttpStatusCode.Ok);
  assert.equal(formFields(review)['user_code'], approval.userCode);

  await approveAndClaimKey({ stack, approval, browser: account.browser, review });
}
