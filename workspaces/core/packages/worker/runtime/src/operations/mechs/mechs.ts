import type { ControlStore } from '@mechane/control-store';
import { catalog, ModelInvalid, TurnEnded, TurnNotFound, TurnRuntimeSource } from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import type { TurnId } from '@mechane/records';
import { waitFor } from '@mechane/utilities';
import { Duration, Option } from 'effect';
import { randomUUID } from 'node:crypto';
import type { MechActorResolver } from '../../actor/client.ts';
import type { RuntimeConfiguration } from '../../config.ts';
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
const EVENT_WAIT_POLL = Duration.millis(250);
const COMPLETED_STATES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled']);

export type MechOperationsInput = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly actors: MechActorResolver;
};

type MechIdentity = { readonly workspaceId: string; readonly mechId: string };
type MechAdmission = MechIdentity & { readonly caller: AuthCaller };
type RunAdmission = MechAdmission & { readonly turnId: TurnId };
type MechCopyRequest = { readonly input: OperationInput<typeof catalog.cloneMech>; readonly caller: AuthCaller };

function requireModel(configuration: RuntimeConfiguration, model: string): void {
  if (!configuration.model.offers.some((offer) => offer.id === model)) {
    throw new ModelInvalid({ model, offered: configuration.model.offers.map((offer) => offer.id) });
  }
}

export function createMechOperations({ store, configuration, actors }: MechOperationsInput) {
  async function requireMech({ workspaceId, mechId, caller }: MechAdmission) {
    await requireWorkspaceMember({ store, caller, workspaceId });

    return await store.getMech({ workspaceId, mechId });
  }

  async function requireRun({ workspaceId, mechId, turnId, caller }: RunAdmission) {
    await requireMech({ workspaceId, mechId, caller });

    const run = await actors({ workspaceId, mechId }).readRun({ turnId });

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
            nativeTools: input.nativeTools ?? null,
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
        const { activeRevision } = await actors(input).readMech();

        return mechRecord(mech, activeRevision);
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
          nativeTools: previous.nativeTools ?? null,
          dailyCapMicros: input.dailyCapMicros ?? previous.dailyCapMicros,
          status: input.status ?? previous.status,
        };

        if (input.instructions !== undefined) {
          changes.instructions = Option.getOrNull(input.instructions);
        }

        if (input.nativeTools !== undefined) {
          changes.nativeTools = Option.getOrNull(input.nativeTools);
        }

        const mech = await store.updateMech({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          principalId: authenticated.principalId,
          expectedRevision: input.expectedRevision,
          changes,
        });

        const { activeRevision } = await actors(input).readMech();

        return mechRecord(mech, activeRevision);
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
        const source = actors(copyInput);
        const exported = await source.exportContext({ requestId: copyInput.requestId });

        const mech = await store.forkMechDefinition({
          ...copyInput,
          expectedRevision: exported.definitionRevision,
          sourceSequence: exported.sourceSequence,
        });

        await actors({ workspaceId: mech.workspaceId, mechId: mech.id }).importContext({
          requestId: copyInput.requestId,
          exported,
        });

        return mechRecord(mech);
      },
    }),
    listMechHistory: validatedOperation({
      operation: catalog.listMechHistory,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await actors(input).listHistory({ after: Option.getOrNull(input.after), maxRows: PAGE_MAX_ROWS });

        return {
          entries: page.entries.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            text: entry.text,
            turn_id: entry.turnId,
            created_at: entry.createdAt,
          })),
          has_more: page.hasMore,
          next_cursor: page.nextCursor,
        };
      },
    }),
    listTurns: validatedOperation({
      operation: catalog.listTurns,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await actors(input).listRuns({ after: Option.getOrNull(input.after), maxRows: PAGE_MAX_ROWS });

        return { turns: page.items.map(runRecord), has_more: page.hasMore };
      },
    }),
    showTurn: validatedOperation({
      operation: catalog.showTurn,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const trace = await actors(input).readTrace({ turnId: input.turnId });

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

        if (run.runtimeSource === TurnRuntimeSource.Imported) {
          throw new TurnEnded({ turnId: input.turnId });
        }

        if (run.cancelRequestedAt === null && COMPLETED_STATES.has(run.status)) {
          throw new TurnEnded({ turnId: input.turnId });
        }

        await actors(input).cancelRun({ turnId: input.turnId, principalId: authenticated.principalId });

        const receipt = await actors(input).readCancellation({ turnId: input.turnId });

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

        const selection: { beforeSequence?: number; isNewestFirst: boolean; maxRows: number } = {
          isNewestFirst: true,
          maxRows: PAGE_MAX_ROWS,
        };

        if (Option.isSome(input.before)) {
          selection.beforeSequence = input.before.value;
        }

        const page = await actors(input).listEvents(selection);

        return { events: page.events.map(activityRecord), has_more: page.hasMore };
      },
    }),
    listEvents: validatedOperation({
      operation: catalog.listEvents,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const deadlineMs = performance.now() + Duration.toMillis(input.wait);

        while (performance.now() < deadlineMs) {
          const page = await actors(input).listEvents({ afterSequence: input.after, maxRows: PAGE_MAX_ROWS });

          if (page.events.length > 0) {
            return { events: page.events.map(activityRecord), has_more: page.hasMore };
          }

          const waitMilliseconds = Math.max(
            0,
            Math.min(Duration.toMillis(EVENT_WAIT_POLL), deadlineMs - performance.now()),
          );

          await waitFor({ span: Duration.millis(waitMilliseconds) });
        }

        const page = await actors(input).listEvents({ afterSequence: input.after, maxRows: PAGE_MAX_ROWS });

        return { events: page.events.map(activityRecord), has_more: page.hasMore };
      },
    }),
    listTurnEvents: validatedOperation({
      operation: catalog.listTurnEvents,
      run: async ({ input, caller }) => {
        await requireRun({ ...input, caller });

        const page = await actors(input).listEvents({
          runId: input.turnId,
          afterSequence: input.after,
          maxRows: PAGE_MAX_ROWS,
        });

        return { events: page.events.map(activityRecord), has_more: page.hasMore };
      },
    }),
  };
}
