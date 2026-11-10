import { MachineId, ModelToolCallId, SessionId } from '@mechane/records';
import { BrowserAction, BrowserRequest, BrowserResponse, BrowserResult, SandboxRunId } from '@mechane/sandbox-wire';
import type { BrowserTab } from '@mechane/sandbox-wire';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Result, Schema } from 'effect';
import { interactiveRuns } from '../interactive-runs.ts';
import { replayInteractiveClaim } from '../replay-interactive-claim.ts';

const BrowserCallFailure = Schema.Struct({ reason: Schema.String, isUncertain: Schema.Boolean });

/** A durable action intent and its actual guest receipt keep retries from repeating browser effects. */
export const BrowserCall = Schema.Struct({
  request: BrowserRequest,
  runId: SandboxRunId,
  sessionId: SessionId,
  toolCallId: ModelToolCallId,
  /** Absence means the action has not been assigned to a machine. */
  machineId: Schema.OptionFromNullOr(MachineId),
  /** Absence means no actual guest receipt has been recorded. */
  response: Schema.OptionFromNullOr(BrowserResponse),
  /** Absence means no terminal failure has been recorded. */
  failure: Schema.OptionFromNullOr(BrowserCallFailure),
});

export type BrowserCall = typeof BrowserCall.Type;
type BrowserIdentity = Pick<BrowserRequest, 'requestId'>;
type ClaimInput = Pick<BrowserCall, 'request' | 'runId' | 'sessionId' | 'toolCallId'>;
type AssignInput = BrowserIdentity & { readonly machineId: typeof MachineId.Type };
type SaveInput = { readonly machineId: typeof MachineId.Type; readonly response: BrowserResponse };
type FailureInput = BrowserIdentity & typeof BrowserCallFailure.Type;
type TabInput = Pick<BrowserTab, 'tabId'>;
type WriteCallInput = { readonly record: BrowserCall };
type CancelBrowserRunInput = { readonly runId: SandboxRunId };
const CallJson = Schema.fromJsonString(BrowserCall);
const StoredCall = Schema.Struct({ record: CallJson });
const RequestJson = Schema.fromJsonString(BrowserRequest);
const BrowserMachine = Schema.Struct({ machineId: MachineId });

class BrowserRequestReused extends Schema.TaggedError<BrowserRequestReused>()('BrowserRequestReused', {
  requestId: BrowserRequest.fields.requestId,
}) {}

class BrowserCallMissing extends Schema.TaggedError<BrowserCallMissing>()('BrowserCallMissing', {
  requestId: BrowserRequest.fields.requestId,
}) {}

/** Browser effects and tab identities remain attached to their first machine across retries. */
export function browserRecords({ sql }: RecordsInput) {
  function browserCall({ requestId }: BrowserIdentity): Option.Option<BrowserCall> {
    const cursor = sql.exec('SELECT record FROM browser_calls WHERE id = ?', requestId);
    const stored = decodeFirst({ cursor, schema: StoredCall });

    return Option.map(stored, ({ record }) => record);
  }

  function requiredBrowserCall({ requestId }: BrowserIdentity): BrowserCall {
    const stored = browserCall({ requestId });

    if (Option.isNone(stored)) {
      const cause = new BrowserCallMissing({ requestId });
      const failed = Result.fail(cause);

      return Result.getOrThrow(failed);
    }

    return stored.value;
  }

  function writeCall({ record }: WriteCallInput): void {
    const value = Schema.encodeSync(CallJson)(record);
    const machineId = Option.getOrNull(record.machineId);

    sql.exec(
      'UPDATE browser_calls SET machine_id = ?, record = ? WHERE id = ?',
      machineId,
      value,
      record.request.requestId,
    );
  }

  function claimBrowserCall({ request, runId, sessionId, toolCallId }: ClaimInput): BrowserCall {
    const existing = browserCall(request);

    if (Option.isSome(existing)) {
      const previous = Schema.encodeSync(RequestJson)(existing.value.request);
      const repeated = Schema.encodeSync(RequestJson)(request);

      const isSamePayload = previous === repeated && existing.value.sessionId === sessionId;
      const mismatch = new BrowserRequestReused({ requestId: request.requestId });

      return replayInteractiveClaim({ existing: existing.value, runId, toolCallId, isSamePayload, mismatch });
    }

    const runs = interactiveRuns({ sql });
    const canceled = runs.canceledInteractiveRun({ runId });

    const failure = Option.map(canceled, () => ({
      reason: 'the originating run was canceled before this browser action was admitted',
      isUncertain: false,
    }));

    const record: BrowserCall = {
      request,
      runId,
      sessionId,
      toolCallId,
      machineId: Option.none(),
      response: Option.none(),
      failure,
    };

    const value = Schema.encodeSync(CallJson)(record);

    sql.exec('INSERT INTO browser_calls (id, run_id, record) VALUES (?, ?, ?)', request.requestId, runId, value);

    return record;
  }

  function assignBrowserCall({ requestId, machineId }: AssignInput): BrowserCall {
    const record = requiredBrowserCall({ requestId });

    if (Option.isSome(record.machineId) || Option.isSome(record.response) || Option.isSome(record.failure)) {
      return record;
    }

    const assigned = { ...record, machineId: Option.some(machineId) };

    writeCall({ record: assigned });

    if (BrowserAction.guards.Open(record.request.action)) {
      sql.exec(
        'INSERT INTO browser_machine (slot, machine_id) VALUES (1, ?) ON CONFLICT (slot) DO UPDATE SET machine_id = excluded.machine_id',
        machineId,
      );
    }

    return assigned;
  }

  /** A failed unassigned claim is also a tombstone against an initial submission arriving later. */
  function abandonBrowserCall({ request, runId, sessionId, toolCallId }: ClaimInput): BrowserCall {
    const record = claimBrowserCall({ request, runId, sessionId, toolCallId });

    if (Option.isSome(record.machineId) || Option.isSome(record.response) || Option.isSome(record.failure)) {
      return record;
    }

    failBrowserCall({
      requestId: record.request.requestId,
      reason: 'the original browser action was abandoned before dispatch',
      isUncertain: false,
    });

    return requiredBrowserCall({ requestId: record.request.requestId });
  }

  function browserMachine(): Option.Option<typeof MachineId.Type> {
    const cursor = sql.exec('SELECT machine_id AS machineId FROM browser_machine WHERE slot = 1');
    const row = decodeFirst({ cursor, schema: BrowserMachine });

    return Option.map(row, ({ machineId }) => machineId);
  }

  function browserTabMachine({ tabId }: TabInput): Option.Option<typeof MachineId.Type> {
    const cursor = sql.exec('SELECT machine_id AS machineId FROM browser_tabs WHERE tab_id = ?', tabId);
    const row = decodeFirst({ cursor, schema: BrowserMachine });

    return Option.map(row, ({ machineId }) => machineId);
  }

  function saveBrowserResponse({ machineId, response }: SaveInput): void {
    const record = requiredBrowserCall({ requestId: response.requestId });

    const isRefused = Option.exists(record.failure, (failure) => !failure.isUncertain);

    if (Option.isSome(record.response) || isRefused) {
      return;
    }

    if (Option.isNone(record.machineId) || record.machineId.value !== machineId) {
      return;
    }

    const completed = { ...record, response: Option.some(response), failure: Option.none() };

    writeCall({ record: completed });

    const result = response.result;
    const tabs: Array<BrowserTab['tabId']> = [];

    if ('tab' in result) {
      tabs.push(result.tab.tabId);
    }

    if (BrowserResult.guards.Tabs(result)) {
      const resultTabs = result.tabs.map(({ tabId }) => tabId);

      tabs.push(...resultTabs);
    }

    for (const tabId of tabs) {
      sql.exec('INSERT INTO browser_tabs (tab_id, machine_id) VALUES (?, ?) ON CONFLICT DO NOTHING', tabId, machineId);
    }
  }

  function failBrowserCall({ requestId, reason, isUncertain }: FailureInput): void {
    const record = requiredBrowserCall({ requestId });

    if (Option.isSome(record.response) || Option.isSome(record.failure)) {
      return;
    }

    const failed = { ...record, failure: Option.some({ reason, isUncertain }) };

    writeCall({ record: failed });
  }

  function loseMachineBrowserCalls({ machineId }: Pick<AssignInput, 'machineId'>): void {
    const cursor = sql.exec('SELECT record FROM browser_calls WHERE machine_id = ?', machineId);
    const rows = decodeRows({ cursor, schema: StoredCall });

    for (const { record } of rows) {
      failBrowserCall({
        requestId: record.request.requestId,
        reason: 'the original browser machine was lost; the action was not replayed',
        isUncertain: true,
      });
    }
  }

  function cancelBrowserRun({ runId }: CancelBrowserRunInput): void {
    const cursor = sql.exec('SELECT record FROM browser_calls WHERE run_id = ?', runId);
    const rows = decodeRows({ cursor, schema: StoredCall });

    for (const { record } of rows) {
      const isUncertain = Option.isSome(record.machineId);

      const reason =
        'the originating run was canceled before the browser action completed; an assigned action may have acted';

      failBrowserCall({ requestId: record.request.requestId, reason, isUncertain });
    }
  }

  return {
    browserCall,
    requiredBrowserCall,
    claimBrowserCall,
    assignBrowserCall,
    abandonBrowserCall,
    browserMachine,
    browserTabMachine,
    saveBrowserResponse,
    failBrowserCall,
    cancelBrowserRun,
    loseMachineBrowserCalls,
  };
}
