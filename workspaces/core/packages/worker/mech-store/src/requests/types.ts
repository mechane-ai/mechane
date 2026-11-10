import type { ExternalRequestKind, ExternalRequestStatus } from '@mechane/protocol';
import type { ExternalRequestId, InboxItemId, ThreadId } from '@mechane/records';
import type { DateTime } from 'effect';
import type { TaskIdInput } from '../task.types.ts';

export type BeginRequestWaitInput = TaskIdInput & {
  readonly threadId: ThreadId;
  readonly kind: ExternalRequestKind;
  readonly requestId: ExternalRequestId;
  readonly serviceIdentity: string;
  readonly inboxItemId: InboxItemId;
  readonly now: DateTime.Utc;
  readonly expiresAt: DateTime.Utc;
};

export type SettleRequestWaitInput = TaskIdInput & {
  readonly result: ExternalRequestStatus;
  readonly now: DateTime.Utc;
};

export type DeferRequestWaitInput = TaskIdInput & { readonly nextPollAt: DateTime.Utc };
