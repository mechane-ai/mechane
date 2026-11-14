import { StoreConflict } from '@mechane/control-store';
import { BrowserEvidenceProgress, evidenceViewerPath } from '@mechane/protocol';
import type { NativeToolName } from '@mechane/protocol';
import { toolExecutionId as executionId } from '@mechane/records';
import { BrowserAction, SandboxBrowserSubmission } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import type { ExecutionReceipt } from '../../domain.ts';
import { toolConfiguration, withToolStore } from '../context.ts';
import type { RuntimeToolStore } from '../context.ts';
import { permitsNativeTool } from '../native-tools.ts';
import { readExecutionReceipt } from '../read-execution-receipt.ts';
import type { RuntimeToolContext, ToolInvocation } from '../types.ts';
import { BrowserTransportInterruptedError, requestBrowser, requestBrowserAbandon } from './browser-client.ts';
import { hasBrowserImageInput } from './browser-model.ts';
import { boundBrowserToolResult, readBrowserToolResult } from './browser-result.ts';
import type { BrowserToolResult } from './browser-result.ts';

const BROWSER_READ_OR_CLEANUP: ReadonlySet<BrowserAction['_tag']> = new Set([
  'Tabs',
  'Observe',
  'Console',
  'Network',
  'Close',
  'RecordStop',
]);

const BROWSER_TOOL_NAMES: Readonly<Record<BrowserAction['_tag'], NativeToolName>> = {
  Tabs: 'browser_tabs',
  Open: 'browser_open',
  Close: 'browser_close',
  Navigate: 'browser_navigate',
  Observe: 'browser_observe',
  Click: 'browser_click',
  Type: 'browser_type',
  Scroll: 'browser_scroll',
  Key: 'browser_key',
  Screenshot: 'browser_screenshot',
  RecordStart: 'browser_record_start',
  RecordStop: 'browser_record_stop',
  Console: 'browser_console',
  Network: 'browser_network',
};

export function browserToolName(action: BrowserAction['_tag']): NativeToolName {
  return BROWSER_TOOL_NAMES[action];
}

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);
export type BrowserInvocation = ToolInvocation & { readonly action: typeof BrowserAction.Encoded };
type BrowserObservation = RuntimeToolContext & { readonly executionId: string };
type BrowserExecutionInput = BrowserInvocation & { readonly hasExpired?: () => boolean };

export async function executeBrowser(input: BrowserExecutionInput): Promise<BrowserToolResult> {
  const id = await executionId(input);

  try {
    return await withToolStore(async (store) => {
      const hasImageInput = await hasBrowserImageInput({ ...input, store });
      const decodedAction = Schema.decodeUnknownSync(BrowserAction, { onExcessProperty: 'error' })(input.action);
      const action = Schema.encodeSync(BrowserAction)(decodedAction);
      const request = { action };
      const prior = await store.getExecution({ id, workspaceId: input.workspaceId, mechId: input.mechId });
      const identity = { ...input, executionId: id };

      if (prior !== null) {
        const isMatching =
          prior.kind === 'browser' && prior.runId === input.runId && isDeepStrictEqual(prior.request, request);

        if (!isMatching) {
          return failedBrowserResult({ id, reason: 'This browser receipt is already bound to another native action' });
        }

        if (FINAL_RECEIPT_STATES.has(prior.status)) {
          const saved = readBrowserToolResult(prior.result);

          return boundBrowserToolResult({ ...saved, hasImageInput });
        }

        const observed = await requestBrowser({ ...identity, submission: null });
        const result = visibleBrowserResult({ id, answer: observed, hasImageInput });
        const recorded = await recordBrowserResult({ store, context: input, result });

        if (recorded.progress._tag !== 'Pending') {
          return recorded;
        }

        if (!recorded.progress.isDispatchRequired || input.hasExpired?.() === true) {
          return recorded;
        }

        const isPermitted = await permitsBrowserSubmission({ input, store, action: action._tag });

        if (!isPermitted || !(await store.canDispatchExecution())) {
          return recorded;
        }
      }

      const isPermitted = await permitsBrowserSubmission({ input, store, action: action._tag });

      if (!isPermitted || input.hasExpired?.() === true) {
        return failedBrowserResult({ id, reason: 'Browser execution is not enabled for this active run' });
      }

      const begun = await store.beginExecution({ id, runId: input.runId, kind: 'browser', request });

      if (FINAL_RECEIPT_STATES.has(begun.receipt.status)) {
        const saved = readBrowserToolResult(begun.receipt.result);

        return boundBrowserToolResult({ ...saved, hasImageInput });
      }

      const admitted = await recordBrowserResult({
        store,
        context: input,
        result: admittedBrowserResult({ receipt: begun.receipt, hasImageInput }),
      });

      if (admitted.progress._tag !== 'Pending') {
        return admitted;
      }

      const submission = browserSubmission({ ...input, action }, id);

      const isStillPermitted = await permitsBrowserSubmission({ input, store, action: action._tag });

      const isCurrent = BROWSER_READ_OR_CLEANUP.has(action._tag) || (await store.canDispatchExecution());

      if (!isStillPermitted || !isCurrent || input.hasExpired?.() === true) {
        if (!begun.wasCreated) {
          return admitted;
        }

        const result = failedBrowserResult({
          id,
          reason: 'The current run or sandbox policy no longer permits new work',
        });

        return await recordBrowserResult({ store, context: input, result });
      }

      const answer = await requestBrowser({ ...identity, submission });

      const result = visibleBrowserResult({ id, answer, hasImageInput });

      return await recordBrowserResult({ store, context: input, result });
    });
  } catch (error) {
    if (error instanceof BrowserTransportInterruptedError) {
      return {
        ...uncertainBrowserResult({ id }),
        progress: {
          _tag: 'Pending',
          reason: 'The browser transport was interrupted; its original receipt is being reconciled',
          isDispatchRequired: false,
        },
      };
    }

    return uncertainBrowserResult({ id });
  }
}

type AdmittedBrowserInput = { readonly receipt: ExecutionReceipt; readonly hasImageInput: boolean };

function admittedBrowserResult({ receipt, hasImageInput }: AdmittedBrowserInput): BrowserToolResult {
  if (receipt.result !== null) {
    const saved = readBrowserToolResult(receipt.result);

    return boundBrowserToolResult({ ...saved, hasImageInput });
  }

  return {
    executionId: receipt.id,
    progress: {
      _tag: 'Pending',
      reason: 'The browser action is admitted and waiting for its original receipt',
      isDispatchRequired: false,
    },
    evidence: null,
    viewerUrl: null,
    hasImageInput,
  };
}

function browserSubmission(input: BrowserInvocation, id: string): typeof SandboxBrowserSubmission.Encoded {
  const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)({
    runId: input.runId,
    sessionId: input.sessionId,
    toolCallId: input.toolCallId,
    request: { requestId: id, action: input.action },
  });

  return Schema.encodeSync(SandboxBrowserSubmission)(submission);
}

/** Scoped abandonment only fences this immutable action; the service proves that it never acquired a machine. */
export async function abandonBrowserExecution(input: BrowserInvocation): Promise<BrowserToolResult> {
  const id = await executionId(input);

  await requestBrowserAbandon({ ...input, executionId: id, submission: browserSubmission(input, id) });

  return await observeBrowser({ ...input, executionId: id });
}

type BrowserAdmissionInput = {
  readonly input: BrowserInvocation;
  readonly store: RuntimeToolStore;
  readonly action: BrowserAction['_tag'];
};

async function permitsBrowserSubmission({ input, store, action }: BrowserAdmissionInput): Promise<boolean> {
  const mech = await store.getMech(input);
  const name = browserToolName(action);

  if (!permitsNativeTool({ name, nativeTools: mech.nativeTools })) {
    return false;
  }

  const policy = await store.getRuntimePolicy(input);
  const run = await store.getRun({ workspaceId: input.workspaceId, runId: input.runId });
  const isWorkspaceEnabled = policy !== null && !policy.isSuspended;
  const hasSandbox = isWorkspaceEnabled && policy.hasSandboxes && policy.machines > 0;
  const isActive = run !== null && run.status === 'running' && run.cancelRequestedAt === null;
  const canMutate = mech.status === 'active' && hasSandbox;

  return isActive && (canMutate || BROWSER_READ_OR_CLEANUP.has(action));
}

/** Status reads reconcile capture publication but never admit or redispatch a browser action. */
export async function observeBrowser(input: BrowserObservation): Promise<BrowserToolResult> {
  try {
    return await withToolStore(async (store) => {
      const hasImageInput = await hasBrowserImageInput({ ...input, store });
      const receipt = await readExecutionReceipt({ ...input, store, kind: 'browser' });

      if (receipt === null) {
        return failedBrowserResult({ id: input.executionId, reason: 'This mech has no matching browser execution' });
      }

      if (FINAL_RECEIPT_STATES.has(receipt.status)) {
        const saved = readBrowserToolResult(receipt.result);

        return boundBrowserToolResult({ ...saved, hasImageInput });
      }

      const answer = await requestBrowser({ ...input, submission: null });

      const result = visibleBrowserResult({ id: input.executionId, answer, hasImageInput });

      return await recordBrowserResult({ store, context: input, result });
    });
  } catch {
    return uncertainBrowserResult({ id: input.executionId });
  }
}

type VisibleResultInput = {
  readonly id: string;
  readonly answer: BrowserEvidenceProgress;
  readonly hasImageInput: boolean;
};

function visibleBrowserResult({ id, answer, hasImageInput }: VisibleResultInput): BrowserToolResult {
  const encoded = Schema.encodeSync(BrowserEvidenceProgress)(answer);
  const configuration = toolConfiguration();

  const viewerUrl: string | null = (() => {
    if (Option.isNone(answer.evidence)) {
      return null;
    }

    return new URL(evidenceViewerPath(answer.evidence.value), configuration.publicOrigin).href;
  })();

  return boundBrowserToolResult({ executionId: id, ...encoded, viewerUrl, hasImageInput });
}

type FailureInput = { readonly id: string; readonly reason: string };

function failedBrowserResult({ id, reason }: FailureInput): BrowserToolResult {
  return {
    executionId: id,
    progress: { _tag: 'Failed', reason },
    evidence: null,
    viewerUrl: null,
    hasImageInput: false,
  };
}

function uncertainBrowserResult({ id }: Pick<FailureInput, 'id'>): BrowserToolResult {
  return {
    executionId: id,
    progress: {
      _tag: 'Uncertain',
      reason: 'The browser action may have run. Use browser_status with this executionId before issuing another action',
    },
    evidence: null,
    viewerUrl: null,
    hasImageInput: false,
  };
}

type RecordResultInput = {
  readonly store: RuntimeToolStore;
  readonly context: RuntimeToolContext;
  readonly result: BrowserToolResult;
};

async function recordBrowserResult({ store, context, result }: RecordResultInput): Promise<BrowserToolResult> {
  const progress = result.progress;

  const status: 'running' | 'uncertain' | 'failed' | 'completed' = (() => {
    if (progress._tag === 'Pending') {
      return 'running';
    }

    if (progress._tag === 'Uncertain') {
      return 'uncertain';
    }

    if (progress._tag === 'Failed') {
      return 'failed';
    }

    if (progress.response.result._tag === 'Uncertain') {
      return 'uncertain';
    }

    if (progress.response.result._tag === 'Failed') {
      return 'failed';
    }

    return 'completed';
  })();

  try {
    await store.finishExecution({ id: result.executionId, status, providerId: result.executionId, result });

    return result;
  } catch (error) {
    if (!(error instanceof StoreConflict)) {
      throw error;
    }

    const committed = await readExecutionReceipt({
      ...context,
      store,
      executionId: result.executionId,
      kind: 'browser',
    });

    if (committed === null || !FINAL_RECEIPT_STATES.has(committed.status)) {
      throw error;
    }

    const output = readBrowserToolResult(committed.result);

    return boundBrowserToolResult({ ...output, hasImageInput: result.hasImageInput });
  }
}
