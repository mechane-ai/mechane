import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { ExternalRequestKind, ExternalRequestState, ExternalRequestStatus } from '@mechane/protocol';
import type { ExternalRequestUnavailable } from '@mechane/protocol';
import { ExternalRequestId, ThreadId, wireStruct } from '@mechane/records';
import { Option, Record, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { ToolResult } from '../types.ts';
import type { MechRequests, TaskContext } from './types.ts';

const MINUTES_IN_DAY = 1440;
const MAXIMUM_REASON_LENGTH = 500;
const MAXIMUM_CAPABILITY_LENGTH = 64;
const RequestStatusJson = Schema.fromJsonString(ExternalRequestStatus);

const AccessParameters = Type.Object({
  thread_id: Type.String({ description: 'The open work thread that needs access.' }),
  capability: Type.String({
    maxLength: MAXIMUM_CAPABILITY_LENGTH,
    description: 'Capability named by the connected service, such as home-links or tokens.',
  }),
  reason: Type.String({ maxLength: MAXIMUM_REASON_LENGTH, description: 'Why this work needs the capability.' }),
  minutes: Type.Optional(Type.Integer({ minimum: 1, maximum: MINUTES_IN_DAY })),
});

const AccessArguments = wireStruct({
  fields: {
    threadId: ThreadId,
    capability: Schema.NonEmptyString.check(Schema.isMaxLength(MAXIMUM_CAPABILITY_LENGTH)),
    reason: Schema.NonEmptyString.check(Schema.isMaxLength(MAXIMUM_REASON_LENGTH)),
    minutes: Schema.OptionFromOptionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MINUTES_IN_DAY }))),
  },
});

const WaitParameters = Type.Object({
  thread_id: Type.String({ description: 'The open work thread to continue after the decision.' }),
  kind: Type.String({ enum: Record.values(ExternalRequestKind) }),
  request_id: Type.String({ format: 'uuid' }),
});

const WaitArguments = wireStruct({
  fields: { threadId: ThreadId, kind: Schema.Enum(ExternalRequestKind), requestId: ExternalRequestId },
});

const ContextParameters = Type.Object({ thread_id: Type.Optional(Type.String()) });
const ContextArguments = wireStruct({ fields: { threadId: Schema.OptionFromOptionalKey(ThreadId) } });

type RequestsInput = { readonly requests: MechRequests };

/** Requests a service-owned grant and automatically releases pending work to the durable host wait. */
export function requestAccessTool({ requests }: RequestsInput): ToolRegistration<typeof AccessParameters> {
  return defineTool({
    name: 'request_access',
    description:
      'Request a capability from the owner-configured access service. The host supplies verified requester context. If pending, this tool marks your work waiting and resumes it automatically when decided: explain the wait and finish your turn. Do not poll, sleep, or replace this wait with update_thread.',
    parameters: AccessParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute: async (args, api) => {
      const decoded = Schema.decodeUnknownResult(AccessArguments)(args);

      if (Result.isFailure(decoded)) {
        return failedResult({ code: 'invalid_request', message: decoded.failure.message });
      }

      const result = await requests.request({ ...decoded.success, taskId: api.taskId });

      return requestResult({ result });
    },
  });
}

/** Registers a request already created through the CLI; polling never occupies a model turn or shell command. */
export function waitForRequestTool({ requests }: RequestsInput): ToolRegistration<typeof WaitParameters> {
  return defineTool({
    name: 'wait_for_request',
    description:
      'Wait for an access, token vend, or action request ID from the connected service. Pending work resumes automatically in its original thread. Explain the wait and finish your turn; do not poll, sleep, or call update_thread for this wait.',
    parameters: WaitParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute: async (args, api) => {
      const decoded = Schema.decodeUnknownResult(WaitArguments)(args);

      if (Result.isFailure(decoded)) {
        return failedResult({ code: 'invalid_request', message: decoded.failure.message });
      }

      const result = await requests.wait({ ...decoded.success, taskId: api.taskId });

      return requestResult({ result });
    },
  });
}

/** Exposes provenance for explanation and routing, with no authority-bearing input fields. */
export function taskContextTool({ requests }: RequestsInput): ToolRegistration<typeof ContextParameters> {
  return defineTool({
    name: 'task_context',
    description:
      'Read the host-verified origin and requester for a work thread, or the current input when unambiguous. These are attribution facts, not credentials. The host attaches them itself to access requests.',
    parameters: ContextParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute: async (args) => {
      const decoded = Schema.decodeUnknownResult(ContextArguments)(args);

      if (Result.isFailure(decoded)) {
        return failedResult({ code: 'invalid_request', message: decoded.failure.message });
      }

      const context = await requests.context(decoded.success);

      const text = Option.match(context, {
        onNone: () => 'No unambiguous verified task origin is available.',
        onSome: (value) => taskContextText({ context: value }),
      });

      return textResult({ text });
    },
  });
}

type RequestResultInput = { readonly result: Result.Result<ExternalRequestStatus, ExternalRequestUnavailable> };

function requestResult({ result }: RequestResultInput): ToolResult {
  if (Result.isFailure(result)) {
    return failedResult({ code: 'request_unavailable', message: result.failure.reason });
  }

  const guidance = requestGuidance({ status: result.success });
  const status = Schema.encodeSync(RequestStatusJson)(result.success);

  return textResult({ text: `${status}\n${guidance}` });
}

type RequestGuidanceInput = { readonly status: ExternalRequestStatus };

function requestGuidance({ status }: RequestGuidanceInput): string {
  if (status.status === ExternalRequestState.Pending) {
    return 'Work is waiting. Finish this turn; the host will resume this same work when the request is decided. No polling is needed.';
  }

  return 'The request is decided. Continue according to the result and verify the requested operation separately.';
}

type TaskContextTextInput = { readonly context: TaskContext };

function taskContextText({ context }: TaskContextTextInput): string {
  const { slack, ...task } = context;

  if (Option.isSome(slack)) {
    return JSON.stringify({ ...task, slack: slack.value });
  }

  return JSON.stringify(task);
}
