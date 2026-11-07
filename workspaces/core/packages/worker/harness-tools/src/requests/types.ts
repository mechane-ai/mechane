import type { ExternalRequestKind, ExternalRequestStatus, ExternalRequestUnavailable } from '@mechane/protocol';
import type {
  ExternalRequestId,
  InboxItemId,
  MechId,
  SlackChannelId,
  SlackTeamId,
  SlackUserId,
  ThreadId,
} from '@mechane/records';
import type { Option, Result } from 'effect';

export type AccessRequestInput = {
  readonly taskId: number;
  readonly threadId: ThreadId;
  readonly capability: string;
  readonly reason: string;
  /** None leaves the duration to the connected service's policy. */
  readonly minutes: Option.Option<number>;
};

export type RequestWaitInput = {
  readonly taskId: number;
  readonly threadId: ThreadId;
  readonly kind: ExternalRequestKind;
  readonly requestId: ExternalRequestId;
};

/** Slack attribution verified at intake and retained with the work's original inbox item. */
export type TaskSlackContext = {
  readonly workspaceId: SlackTeamId;
  readonly userId: SlackUserId;
  readonly channelId: SlackChannelId;
  readonly threadTs: string;
  readonly messageTs: string;
};

/** Host-owned attribution accompanies access requests without granting the named actor's authority. */
export type TaskContext = {
  readonly runtime: 'mechane';
  readonly instanceId: MechId;
  readonly workId: ThreadId | InboxItemId;
  /** None means this work has no verified Slack origin. */
  readonly slack: Option.Option<TaskSlackContext>;
};

type TaskContextInput = {
  /** None selects the current input, only when that input has an unambiguous origin. */
  readonly threadId: Option.Option<ThreadId>;
};

/** Requests use one owner-configured service and provenance read by the host from the work's original inbox. */
export type MechRequests = {
  readonly request: (
    input: AccessRequestInput,
  ) => Promise<Result.Result<ExternalRequestStatus, ExternalRequestUnavailable>>;
  readonly wait: (input: RequestWaitInput) => Promise<Result.Result<ExternalRequestStatus, ExternalRequestUnavailable>>;
  /** None means no unambiguous verified origin is available for the requested work. */
  readonly context: (input: TaskContextInput) => Promise<Option.Option<TaskContext>>;
};
