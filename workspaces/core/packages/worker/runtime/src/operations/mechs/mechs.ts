import type { ControlStore } from '@mechane/control-store';
import { catalog, TurnNotFound } from '@mechane/protocol';
import type { TurnId } from '@mechane/records';
import { waitFor } from '@mechane/utilities';
import { Duration, Option } from 'effect';
import type { MechActorResolver } from '../../actor/client.ts';
import { requireWorkspaceMember } from '../auth/admission.ts';
import type { AuthCaller } from '../types.ts';
import { validatedOperation } from '../validated-operation.ts';
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

export type MechOperationsInput = { readonly store: ControlStore; readonly actors: MechActorResolver };

type MechIdentity = { readonly workspaceId: string; readonly mechId: string };
type MechAdmission = MechIdentity & { readonly caller: AuthCaller };
type RunAdmission = MechAdmission & { readonly turnId: TurnId };

export function createMechOperations({ store, actors }: MechOperationsInput) {
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

  return {
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
    listArchivedCompletions: validatedOperation({
      operation: catalog.listArchivedCompletions,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        const page = await actors(input).listArchivedCompletions({
          after: Option.getOrNull(input.after),
          maxRows: PAGE_MAX_ROWS,
        });

        return { completions: page.items, has_more: page.hasMore, next_cursor: page.nextCursor };
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
    listHeldWork: validatedOperation({
      operation: catalog.listHeldWork,
      run: async ({ input, caller }) => {
        await requireMech({ ...input, caller });

        return await actors(input).listHeldWork({ after: Option.getOrNull(input.after), maxRows: PAGE_MAX_ROWS });
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
