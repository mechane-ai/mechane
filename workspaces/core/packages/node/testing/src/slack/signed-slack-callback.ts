import { slackEventsPath } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import type { SlackConnectionId, WorkspaceId } from '@mechane/records';
import { DateTime, Duration, Effect } from 'effect';
import { createHmac } from 'node:crypto';
import { sentPage } from '../browser/sent-page.ts';
import type { Page } from '../browser/types.ts';
import { BrowserStep } from '../constants.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';

export type SignedSlackCallbackInput = StackInput & {
  readonly workspaceId: WorkspaceId;
  readonly connectionId: SlackConnectionId;
  readonly signingSecret: string;
  readonly body: string;
};

/** Signing the exact body drives the same authentication boundary as a provider callback. */
export const signedSlackCallback = Effect.fn('signedSlackCallback')(function* ({
  stack,
  workspaceId,
  connectionId,
  signingSecret,
  body,
}: SignedSlackCallbackInput): Effect.fn.Return<Page, ScenarioFailure> {
  const path = slackEventsPath({ workspaceId, connectionId });
  const url = new URL(path, stack.origin);
  const second = Duration.seconds(1);
  const secondMs = Duration.toMillis(second);
  const now = DateTime.nowUnsafe();
  const nowMs = DateTime.toEpochMillis(now);
  const nowSeconds = Math.floor(nowMs / secondMs);
  const timestamp = String(nowSeconds);
  const signature = createHmac('sha256', signingSecret).update(`v0:${timestamp}:${body}`).digest('hex');

  const request = new Request(url, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.SlackRequestTimestamp]: timestamp, [HttpHeader.SlackSignature]: `v0=${signature}` },
    body,
  });

  return yield* sentPage({ step: BrowserStep.Open, request });
});
