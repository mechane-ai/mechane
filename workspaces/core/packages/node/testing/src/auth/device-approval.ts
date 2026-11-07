import { call } from '@mechane/client';
import { KeyPurpose } from '@mechane/protocol';
import type { DeviceApproval, DeviceApprovalPoll } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { Duration, Effect, Option } from 'effect';
import assert from 'node:assert/strict';
import type { BrowserPage, SmokeBrowser } from './types.ts';

type StartApprovalInput = { readonly stack: LocalStack; readonly name: string };
type PollApprovalInput = { readonly stack: LocalStack; readonly approval: DeviceApproval };
type ClaimReviewedKeyInput = PollApprovalInput & { readonly browser: SmokeBrowser; readonly review: BrowserPage };
const REQUEST_TIMEOUT = Duration.seconds(15);

export async function startApproval({ stack, name }: StartApprovalInput): Promise<DeviceApproval> {
  return await Effect.runPromise(
    call({
      name: 'startDeviceApproval',
      input: { name, purpose: KeyPurpose.Named },
      credential: Option.none(),
      origin: stack.origin,
      timeout: REQUEST_TIMEOUT,
      userAgent: 'mechane-smoke',
      maxResponseBytes: Option.none(),
    }),
  );
}

export async function pollApproval({ stack, approval }: PollApprovalInput): Promise<DeviceApprovalPoll> {
  return await Effect.runPromise(
    call({
      name: 'pollDeviceApproval',
      input: { pollToken: approval.pollToken },
      credential: Option.none(),
      origin: stack.origin,
      timeout: REQUEST_TIMEOUT,
      userAgent: 'mechane-smoke',
      maxResponseBytes: Option.none(),
    }),
  );
}

export async function approveAndClaimKey({ stack, approval, browser, review }: ClaimReviewedKeyInput) {
  const approved = await browser.submit({ page: review });

  assert.equal(approved.status, HttpStatusCode.Ok);

  const claimed = await pollApproval({ stack, approval });

  assert.equal(claimed.status, 'approved');

  return claimed;
}
