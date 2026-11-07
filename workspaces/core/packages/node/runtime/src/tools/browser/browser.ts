import { BrowserEvidenceProgress, evidenceViewerPath } from '@mechane/protocol';
import { BrowserAction, SandboxBrowserSubmission } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { sleep } from 'workflow';
import { loadRuntimeConfiguration } from '../../config.ts';
import type { RuntimeStore } from '../../store/database.ts';
import { StoreConflict } from '../../store/errors.ts';
import { withRuntimeStore } from '../../store/runtime-store.ts';
import { executionId } from '../execution-id.ts';
import { readExecutionReceipt } from '../read-execution-receipt.ts';
import type { RuntimeToolContext, ToolInvocation } from '../types.ts';
import { BrowserTransportInterruptedError, requestBrowser } from './browser-client.ts';
import { hasBrowserImageInput } from './browser-model.ts';
import { boundBrowserToolResult, readBrowserToolResult } from './browser-result.ts';
import type { BrowserToolResult } from './browser-result.ts';

const BROWSER_POLL_ATTEMPTS = 30;
const BROWSER_POLL_INTERVAL_MS = 1000;

const BROWSER_READ_OR_CLEANUP: ReadonlySet<BrowserAction['_tag']> = new Set([
  'Tabs',
  'Observe',
  'Console',
  'Network',
  'Close',
  'RecordStop',
]);

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);
type BrowserInvocation = ToolInvocation & { readonly action: typeof BrowserAction.Encoded };
type BrowserObservation = RuntimeToolContext & { readonly executionId: string };

/** Workflow sleeps between bounded submissions; retries retain the exact original native call identity. */
export async function executeBrowser(input: BrowserInvocation): Promise<BrowserToolResult> {
  let result = await submitBrowser(input);

  for (let attempt = 1; attempt < BROWSER_POLL_ATTEMPTS && result.progress._tag === 'Pending'; attempt += 1) {
    await sleep(BROWSER_POLL_INTERVAL_MS);

    result = await submitBrowser(input);
  }

  if (result.progress._tag !== 'Pending') {
    return result;
  }

  return {
    ...result,
    progress: {
      _tag: 'Uncertain',
      reason:
        'The original browser receipt could not be confirmed within the retry limit; use browser_status before any new action',
    },
  };
}

async function submitBrowser(input: BrowserInvocation): Promise<BrowserToolResult> {
  'use step';

  const id = await executionId(input);

  try {
    return await withRuntimeStore(async (store) => {
      const hasImageInput = await hasBrowserImageInput({ ...input, store });
      const decodedAction = Schema.decodeUnknownSync(BrowserAction, { onExcessProperty: 'error' })(input.action);
      const action = Schema.encodeSync(BrowserAction)(decodedAction);
      const request = { action };
      const prior = await store.getExecution({ id, workspaceId: input.workspaceId, mechId: input.mechId });
      const identity = { ...input, executionId: id };
      const mech = await store.getMech(input);
      const policy = await store.getRuntimePolicy(input);
      const run = await store.getRun({ workspaceId: input.workspaceId, runId: input.runId });
      const isWorkspaceEnabled = policy !== null && !policy.isSuspended;
      const hasSandbox = isWorkspaceEnabled && policy.hasSandboxes && policy.machines > 0;
      const isActive = run !== null && run.status === 'running' && run.cancelRequestedAt === null;
      const canMutate = mech.status === 'active' && hasSandbox;
      const isPermitted = isActive && (canMutate || BROWSER_READ_OR_CLEANUP.has(action._tag));

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

        if (!isPermitted) {
          return recorded;
        }
      }

      if (!isPermitted) {
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
        result: {
          executionId: id,
          progress: { _tag: 'Pending', reason: 'The browser action is admitted and waiting for its original receipt' },
          evidence: null,
          viewerUrl: null,
          hasImageInput,
        },
      });

      if (admitted.progress._tag !== 'Pending') {
        return admitted;
      }

      const submission = Schema.decodeUnknownSync(SandboxBrowserSubmission)({
        runId: input.runId,
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        request: { requestId: id, action },
      });

      const answer = await requestBrowser({
        ...identity,
        submission: Schema.encodeSync(SandboxBrowserSubmission)(submission),
      });

      const result = visibleBrowserResult({ id, answer, hasImageInput });

      return await recordBrowserResult({ store, context: input, result });
    });
  } catch (error) {
    if (error instanceof BrowserTransportInterruptedError) {
      return {
        ...uncertainBrowserResult({ id }),
        progress: {
          _tag: 'Pending',
          reason: 'The browser transport was interrupted; retrying its original immutable request',
        },
      };
    }

    return uncertainBrowserResult({ id });
  }
}

/** Status reads reconcile capture publication but never admit or redispatch a browser action. */
export async function observeBrowser(input: BrowserObservation): Promise<BrowserToolResult> {
  'use step';

  try {
    return await withRuntimeStore(async (store) => {
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
  const configuration = loadRuntimeConfiguration();

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
  readonly store: RuntimeStore;
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
