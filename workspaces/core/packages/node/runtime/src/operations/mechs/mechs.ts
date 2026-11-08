import {
  catalog,
  InboxItemConflict,
  MechArchived,
  ModelInvalid,
  RequestInvalid,
  TurnEnded,
  TurnNotFound,
} from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import type { TurnId } from '@mechane/records';
import { Duration, Option, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import type { RuntimeConfiguration } from '../../config.ts';
import type { ConsoleOrigin } from '../../domain.ts';
import type { RuntimeStore } from '../../store/database.ts';
import { AdmissionRefused, StoreConflict } from '../../store/errors.ts';
import { requireWorkspaceMember } from '../auth/admission.ts';
import type { AuthCaller } from '../types.ts';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import {
  activityRecord,
  dispatchRecord,
  mechRecord,
  mechSummary,
  replyExcerpt,
  revisionRecord,
  runRecord,
} from './wire.ts';

const PAGE_MAX_ROWS = 50;
const EVENT_WAIT_POLL_MILLISECONDS = 250;
const COMPLETED_STATES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled']);

export type StartAdmission = (input: { readonly runId: string }) => Promise<{ readonly workflowId: string }>;

export type CancelWorkflow = (input: {
  readonly workspaceId: string;
  readonly runId: string;
  readonly cancelerId: string;
}) => Promise<void>;

export type MechOperationsInput = {
  readonly store: RuntimeStore;
  readonly configuration: RuntimeConfiguration;
  readonly startAdmission: StartAdmission;
  readonly cancelWorkflow: CancelWorkflow;
};

type MechIdentity = { readonly workspaceId: string; readonly mechId: string };
type MechAdmission = MechIdentity & { readonly caller: AuthCaller };
type RunAdmission = MechAdmission & { readonly turnId: TurnId };
type MechCopyRequest = { readonly input: OperationInput<typeof catalog.cloneMech>; readonly caller: AuthCaller };

type InputSessionSelection = MechIdentity & {
  readonly sessionId: string | undefined;
  readonly source: ConsoleOrigin['kind'];
};

function requireModel(configuration: RuntimeConfiguration, model: string): void {
  if (!configuration.model.offers.some((offer) => offer.id === model)) {
    throw new ModelInvalid({ model, offered: configuration.model.offers.map((offer) => offer.id) });
  }
}

function originFor(caller: AuthCaller): ConsoleOrigin {
  const authenticated = requireAuthenticated(caller);

  if (authenticated.authKind === 'key') {
    return { kind: 'api', principalId: authenticated.principalId };
  }

  return { kind: 'console', principalId: authenticated.principalId };
}

export function createMechOperations({ store, configuration, startAdmission, cancelWorkflow }: MechOperationsInput) {
  async function requireMech({ workspaceId, mechId, caller }: MechAdmission) {
    await requireWorkspaceMember({ store, caller, workspaceId });

    return await store.getMech({ workspaceId, mechId });
  }

  async function requireRun({ workspaceId, mechId, turnId, caller }: RunAdmission) {
    await requireMech({ workspaceId, mechId, caller });

    const run = await store.getRun({ workspaceId, runId: turnId });

    if (run === null || run.mechId !== mechId) {
      throw new TurnNotFound({ turnId });
    }

    return run;
  }

  async function mechCopyInput({ input, caller }: MechCopyRequest) {
    const authenticated = requireAuthenticated(caller);

    await requireMech({ ...input, caller });

    return {
      workspaceId: input.workspaceId,
      mechId: input.mechId,
      principalId: authenticated.principalId,
      name: input.name,
      requestId: input.requestId ?? randomUUID(),
    };
  }

  async function inputSessionId({ workspaceId, mechId, sessionId, source }: InputSessionSelection): Promise<string> {
    if (sessionId !== undefined) {
      return sessionId;
    }

    const session = await store.ensureSession({ workspaceId, mechId, key: source, source });

    return session.id;
  }

  return {
    createMech: validatedOperation({
      operation: catalog.createMech,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);

        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });

        const model = input.model ?? configuration.defaultModel;

        requireModel(configuration, model);

        const mech = await store.createMech({
          workspaceId: input.workspaceId,
          principalId: authenticated.principalId,
          requestId: input.requestId ?? randomUUID(),
          definition: {
            name: input.name,
            model,
            instructions: input.instructions ?? null,
            dailyCapMicros: input.dailyCapMicros ?? configuration.maxDailyAllowanceMicros,
            status: 'active',
          },
        });

        return mechRecord(mech);
      },
    }),
    listMechs: validatedOperation({
      operation: catalog.listMechs,
      run: async ({ input, caller }) => {
        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });

        const page = await store.listMechs({
          workspaceId: input.workspaceId,
          after: Option.getOrNull(input.after),
          maxRows: PAGE_MAX_ROWS,
        });

        return { mechs: page.items.map(mechSummary), has_more: page.hasMore };
      },
    }),
    showMech: validatedOperation({
      operation: catalog.showMech,
      run: async ({ input, caller }) => {
        const mech = await requireMech({ ...input, caller });
        const activeRevision = await store.getActiveRevision(input);

        return mechRecord(mech, activeRevision ?? mech.revision);
      },
    }),
    updateMech: validatedOperation({
      operation: catalog.updateMech,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);
        const previous = await requireMech({ ...input, caller });

        if (input.model !== undefined) {
          requireModel(configuration, input.model);
        }

        const changes = {
          name: input.name ?? previous.name,
          model: input.model ?? previous.model,
          instructions: previous.instructions,
          dailyCapMicros: input.dailyCapMicros ?? previous.dailyCapMicros,
          status: input.status ?? previous.status,
        };

        if (input.instructions !== undefined) {
          changes.instructions = Option.getOrNull(input.instructions);
        }

        const mech = await store.updateMech({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          principalId: authenticated.principalId,
          expectedRevision: input.expectedRevision,
          changes,
        });

        if (mech.status === 'active') {
          const next = await store.nextQueuedRun({ workspaceId: input.workspaceId, mechId: input.mechId });

          if (next !== null) {
            await startAdmission({ runId: next.id });
          }
        }

        const activeRevision = await store.getActiveRevision(input);

        return mechRecord(mech, activeRevision ?? mech.revision);
      },
    }),
    listMechRevisions: validatedOperation({
      operation: catalog.listMechRevisions,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await store.listMechRevisions({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          after: input.after,
          maxRows: PAGE_MAX_ROWS,
        });

        return { revisions: page.items.map(revisionRecord), has_more: page.hasMore };
      },
    }),
    cloneMech: validatedOperation({
      operation: catalog.cloneMech,
      run: async (context) => {
        const copyInput = await mechCopyInput(context);
        const mech = await store.cloneMech(copyInput);

        return mechRecord(mech);
      },
    }),
    forkMech: validatedOperation({
      operation: catalog.forkMech,
      run: async (context) => {
        const copyInput = await mechCopyInput(context);
        const mech = await store.forkMech(copyInput);

        return mechRecord(mech);
      },
    }),
    sendInboxItem: validatedOperation({
      operation: catalog.sendInboxItem,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);
        const mech = await requireMech({ ...input, caller });
        const origin = originFor(caller);

        const sessionId = await inputSessionId({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          sessionId: input.sessionId,
          source: origin.kind,
        });

        const message = {
          id: input.inboxItemId,
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: input.text }],
        };

        const sessionDetails = await store.getSessionSummary({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          sessionId,
        });

        if (sessionDetails.source === 'slack') {
          throw new RequestInvalid({
            reason: 'Send messages from this conversation’s Slack thread, or use a console conversation',
          });
        }

        const admission = await store
          .admitInput({
            id: input.inboxItemId,
            runId: randomUUID(),
            workspaceId: input.workspaceId,
            mechId: input.mechId,
            sessionId,
            idempotencyKey: `inbox:${input.inboxItemId}`,
            inputText: input.text,
            inputMessage: message,
            origin,
          })
          .catch((error: unknown) => {
            if (error instanceof StoreConflict) {
              throw new InboxItemConflict({ inboxItemId: input.inboxItemId });
            }

            if (error instanceof AdmissionRefused && mech.status === 'archived') {
              throw new MechArchived({ mechId: Schema.decodeUnknownSync(MechId)(input.mechId) });
            }

            throw error;
          });

        await startAdmission({ runId: admission.run.id });

        const page = await store.listActivities({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: admission.run.id,
          maxRows: 1,
        });

        const event = page.items[0];

        if (event === undefined) {
          throw new Error('The admitted input has no receipt.');
        }

        return {
          id: admission.run.inputId,
          text: input.text,
          delivery: 'when_idle',
          sender_id: authenticated.principalId,
          received_at: event.createdAt,
          received_sequence: event.sequence,
        };
      },
    }),
    listTurns: validatedOperation({
      operation: catalog.listTurns,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await store.listRuns({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          after: Option.getOrNull(input.after),
          maxRows: PAGE_MAX_ROWS,
        });

        return { turns: page.items.map(runRecord), has_more: page.hasMore };
      },
    }),
    showTurn: validatedOperation({
      operation: catalog.showTurn,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const trace = await store.getRunTrace({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: input.turnId,
        });

        const excerpt = replyExcerpt(trace.run, trace.events);

        const response = {
          turn: runRecord(trace.run),
          dispatches: trace.dispatches.map(dispatchRecord),
          tool_calls: trace.toolCalls,
          evidence_notices: trace.evidenceNotices,
        };

        if (excerpt === undefined) {
          return response;
        }

        return { ...response, reply_excerpt: excerpt };
      },
    }),
    cancelTurn: validatedOperation({
      operation: catalog.cancelTurn,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);
        const run = await requireRun({ ...input, caller });

        if (run.cancelRequestedAt === null && COMPLETED_STATES.has(run.status)) {
          throw new TurnEnded({ turnId: input.turnId });
        }

        await cancelWorkflow({
          workspaceId: input.workspaceId,
          runId: input.turnId,
          cancelerId: authenticated.principalId,
        });

        const receipt = await store.getRunCancellation({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: input.turnId,
        });

        if (receipt === null) {
          throw new TurnEnded({ turnId: input.turnId });
        }

        return { turn_id: input.turnId, canceled_at: receipt.canceledAt, canceler_id: receipt.cancelerId };
      },
    }),
    listRecentEvents: validatedOperation({
      operation: catalog.listRecentEvents,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const before = Option.getOrUndefined(input.before);

        const page = await store.listActivities({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          before: before ?? null,
          isNewestFirst: true,
          maxRows: PAGE_MAX_ROWS,
        });

        return { events: page.items.map(activityRecord), has_more: page.hasMore };
      },
    }),
    listEvents: validatedOperation({
      operation: catalog.listEvents,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const deadlineMs = performance.now() + Duration.toMillis(input.wait);

        while (performance.now() < deadlineMs) {
          const page = await store.listActivities({
            workspaceId: input.workspaceId,
            mechId: input.mechId,
            after: input.after,
            maxRows: PAGE_MAX_ROWS,
          });

          if (page.items.length > 0) {
            return { events: page.items.map(activityRecord), has_more: page.hasMore };
          }

          await setTimeout(Math.max(0, Math.min(EVENT_WAIT_POLL_MILLISECONDS, deadlineMs - performance.now())));
        }

        const page = await store.listActivities({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          after: input.after,
          maxRows: PAGE_MAX_ROWS,
        });

        return { events: page.items.map(activityRecord), has_more: page.hasMore };
      },
    }),
    listTurnEvents: validatedOperation({
      operation: catalog.listTurnEvents,
      run: async ({ input, caller }) => {
        await requireRun({ ...input, caller });

        const page = await store.listActivities({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: input.turnId,
          after: input.after,
          maxRows: PAGE_MAX_ROWS,
        });

        return { events: page.items.map(activityRecord), has_more: page.hasMore };
      },
    }),
    listMemories: validatedOperation({
      operation: catalog.listMemories,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const memories = await store.listMemories({ workspaceId: input.workspaceId, mechId: input.mechId });

        return {
          memories: memories.map((memory) => ({
            path: memory.path,
            text: memory.text,
            digest: memory.digest,
            version: memory.version,
            turn_id: memory.runId,
            saved_at: memory.updatedAt,
          })),
        };
      },
    }),
    listThreads: validatedOperation({
      operation: catalog.listThreads,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const items = await store.listWorkItems({ workspaceId: input.workspaceId, mechId: input.mechId });
        const cursor = Option.getOrNull(input.after);
        const index = items.findIndex((workItem) => workItem.id === cursor);

        if (cursor !== null && index === -1) {
          throw new RequestInvalid({ reason: 'The work page cursor is not in this mech' });
        }

        const page = items.slice(index + 1, index + 1 + PAGE_MAX_ROWS);

        return {
          threads: page.map((workItem) => ({
            id: workItem.id,
            title: workItem.title,
            state: workItem.state,
            note: workItem.note,
            opened_at: workItem.createdAt,
            updated_at: workItem.updatedAt,
          })),
          has_more: items.length > index + 1 + PAGE_MAX_ROWS,
        };
      },
    }),
    listSessions: validatedOperation({
      operation: catalog.listSessions,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await store.listSessions({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          after: Option.getOrNull(input.after),
          maxRows: PAGE_MAX_ROWS,
        });

        return {
          sessions: page.items.map((session) => ({
            id: session.id,
            mech_id: session.mechId,
            title: session.title,
            source: session.source,
            created_at: session.createdAt,
            updated_at: session.updatedAt,
            active_run_id: session.activeRunId,
          })),
          has_more: page.hasMore,
        };
      },
    }),
  };
}
