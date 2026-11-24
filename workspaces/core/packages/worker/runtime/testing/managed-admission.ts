import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createSession, MemoryStorage } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Deferred, Effect, Exit, Option } from 'effect';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRuntimeEnvironment } from '../src/config.ts';
import { acceptInputs, preflightManagedEvents } from '../src/managed/admission.ts';
import { transition } from '../src/managed/lifecycle.ts';
import { CallReceipts, choose, inputKey, Sessions, Slot, ThreadInputs } from '../src/managed/scheduler.ts';
import { registerManagedPrimary } from '../src/managed/thread-registration.ts';
import { finishManagedTurn } from '../src/managed/turn-settlement.ts';
import { managedUsageProjector, queueSessionUsage, queueThreadUsage } from '../src/managed/usage-projection.ts';

const TEST_TIMEOUT_MS = 5000;
const SESSION_ID = 'sesn_admission_test';
const THREAD_ID = 'sthr_admission_test';
const TOOL_EVENT_ID = 'sevt_tool_wait_01';
const MODEL_ID = 'claude-haiku-5-5';
const WORKSPACE_ID = 'ws_usage_test';
const EXPECTED_QUEUED_PAIR = 2;
const EXPECTED_RECEIPT_COUNT = 3;

type CallSetup = { readonly nativeKind: string; readonly stage: 'approval' | 'result' | 'complete' };

function primarySessionOpen() {
  return {
    sessionId: SESSION_ID,
    threadId: THREAD_ID,
    runtimeMechId: 'mech_1',
    environmentId: 'env_1',
    agent: { id: 'agent_1', name: 'test-agent', version: 1, model: { id: MODEL_ID }, tools: [], mcp_servers: [] },
    creatorId: 'principal_1',
    model: MODEL_ID,
    system: '',
    tools: [],
    initialEvents: [],
  };
}

async function openWaitingSession({ nativeKind, stage }: CallSetup) {
  const session = createSession(new MemoryStorage());

  await session.commit(async (transaction) => {
    const conversation = await transaction.createConversation({ ownership: { kind: 'ownerless' } });

    await registerManagedPrimary(transaction, primarySessionOpen());

    const state = await transaction.doc(Sessions, SESSION_ID, null);

    Object.assign(state, {
      id: SESSION_ID,
      publicSessionId: SESSION_ID,
      threadId: THREAD_ID,
      conversation: conversation.id,
      runtimeMechId: 'mech_1',
      environmentId: 'env_1',
      model: MODEL_ID,
      activeEvent: 'sevt_active_turn_01',
      waiting: TOOL_EVENT_ID,
      status: 'running',
    });

    const receipt = await transaction.doc(CallReceipts, JSON.stringify([SESSION_ID, TOOL_EVENT_ID]), null);

    Object.assign(receipt, { eventId: TOOL_EVENT_ID, nativeId: 'native_tool_01', nativeKind, stage, resultId: '' });

    if (stage === 'approval' || nativeKind === 'custom') {
      await transition(transaction, {
        sessionId: SESSION_ID,
        status: 'idle',
        reason: { type: 'requires_action', event_ids: [TOOL_EVENT_ID] },
      });
    } else {
      await transition(transaction, { sessionId: SESSION_ID, status: 'running' });
    }
  }, BACKGROUND_CONTEXT);

  return session;
}

function userMessage(text: string) {
  return preflightManagedEvents([{ type: 'user.message', content: [{ type: 'text', text }] }]);
}

function systemMessage(text: string) {
  return preflightManagedEvents([{ type: 'system.message', content: [{ type: 'text', text }] }]);
}

void test(
  'user.message queues during in-flight worker and mcp tool calls and drains when the turn settles',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    for (const nativeKind of ['worker', 'mcp']) {
      const session = await openWaitingSession({ nativeKind, stage: 'result' });

      const admitted = await session.commit(
        async (transaction) =>
          await acceptInputs(transaction, { sessionId: SESSION_ID }, userMessage(`follow up during ${nativeKind}`)),
        BACKGROUND_CONTEXT,
      );

      assert.equal(admitted.length, 1);

      const firstAdmitted = admitted[0];

      assert.ok(firstAdmitted !== undefined);
      assert.equal(firstAdmitted.type, 'user.message');
      assert.equal(firstAdmitted.processed_at, null);

      const whileWaiting = await session.commit(async (transaction) => {
        const state = await transaction.doc(Sessions, SESSION_ID, null);
        const queued = await transaction.doc(ThreadInputs, inputKey(SESSION_ID, 0), null);
        const slot = await transaction.doc(Slot);

        return {
          status: state.status,
          waiting: state.waiting,
          pendingHead: state.pendingHead,
          pendingTail: state.pendingTail,
          queuedEventId: queued.eventId,
          slotOwner: slot.owner,
          isReady: state.isReady,
        };
      }, BACKGROUND_CONTEXT);

      assert.equal(whileWaiting.status, 'running');
      assert.equal(whileWaiting.waiting, TOOL_EVENT_ID);
      assert.equal(whileWaiting.pendingHead, 0);
      assert.equal(whileWaiting.pendingTail, 1);
      assert.equal(whileWaiting.queuedEventId, firstAdmitted.id);
      assert.equal(whileWaiting.slotOwner, null);
      assert.equal(whileWaiting.isReady, false);

      const drained = await session.commit(async (transaction) => {
        await finishManagedTurn(transaction, SESSION_ID);

        const state = await transaction.doc(Sessions, SESSION_ID, null);
        const chosen = await choose(transaction);

        return { status: state.status, waiting: state.waiting, chosen };
      }, BACKGROUND_CONTEXT);

      assert.equal(drained.status, 'running');
      assert.equal(drained.waiting, null);
      assert.equal(drained.chosen, SESSION_ID);
    }
  },
);

void test(
  'user.message still rejects with HTTP 400 during custom tool calls and approval waits',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const cases: ReadonlyArray<CallSetup> = [
      { nativeKind: 'custom', stage: 'result' },
      { nativeKind: 'worker', stage: 'approval' },
      { nativeKind: 'mcp', stage: 'approval' },
      { nativeKind: 'custom', stage: 'approval' },
    ];

    for (const callCase of cases) {
      const session = await openWaitingSession(callCase);

      await assert.rejects(
        session.commit(
          async (transaction) =>
            await acceptInputs(transaction, { sessionId: SESSION_ID }, userMessage('should reject')),
          BACKGROUND_CONTEXT,
        ),
        { status: HttpStatusCode.BadRequest, message: 'Resolve the outstanding tool call before sending a message' },
      );
    }
  },
);

void test(
  'system.message queues behind a queued user.message while a runtime tool call is in flight',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const queuedSession = await openWaitingSession({ nativeKind: 'worker', stage: 'result' });

    const batch = preflightManagedEvents([
      { type: 'user.message', content: [{ type: 'text', text: 'queued user prompt' }] },
      { type: 'system.message', content: [{ type: 'text', text: 'instruction after user prompt' }] },
    ]);

    const admitted = await queuedSession.commit(
      async (transaction) => await acceptInputs(transaction, { sessionId: SESSION_ID }, batch),
      BACKGROUND_CONTEXT,
    );

    assert.equal(admitted.length, EXPECTED_QUEUED_PAIR);

    const firstBatchEvent = admitted[0];
    const secondBatchEvent = admitted[1];

    assert.ok(firstBatchEvent !== undefined && secondBatchEvent !== undefined);
    assert.equal(firstBatchEvent.processed_at, null);
    assert.equal(secondBatchEvent.processed_at, null);

    const queue = await queuedSession.commit(async (transaction) => {
      const state = await transaction.doc(Sessions, SESSION_ID, null);
      const first = await transaction.doc(ThreadInputs, inputKey(SESSION_ID, 0), null);
      const second = await transaction.doc(ThreadInputs, inputKey(SESSION_ID, 1), null);

      return { pendingTail: state.pendingTail, first: first.eventId, second: second.eventId };
    }, BACKGROUND_CONTEXT);

    assert.equal(queue.pendingTail, EXPECTED_QUEUED_PAIR);
    assert.equal(queue.first, firstBatchEvent.id);
    assert.equal(queue.second, secondBatchEvent.id);

    const emptyQueueSession = await openWaitingSession({ nativeKind: 'worker', stage: 'result' });

    const immediate = await emptyQueueSession.commit(
      async (transaction) =>
        await acceptInputs(transaction, { sessionId: SESSION_ID }, systemMessage('immediate update')),
      BACKGROUND_CONTEXT,
    );

    assert.equal(immediate.length, 1);
    assert.notEqual(immediate[0]?.processed_at, null);
  },
);

void test(
  'resolveRuntimeEnvironment fetches secrets in parallel, caches per binding, and isolates fresh bindings',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const started: Array<string> = [];
    const barrier = Deferred.makeUnsafe<void>();

    function makeBarrierBinding(name: string, secret: string) {
      const state = { calls: 0 };

      return {
        state,
        binding: {
          get: async (): Promise<string> => {
            state.calls += 1;

            started.push(name);

            if (started.length === EXPECTED_QUEUED_PAIR) {
              Deferred.doneUnsafe(barrier, Exit.void);
            }

            await Effect.runPromise(Deferred.await(barrier));

            return secret;
          },
        },
      };
    }

    const first = makeBarrierBinding('db', 'postgres://first');
    const second = makeBarrierBinding('key', 'secret-upstream-key');

    const environment = { MECHANE_DATABASE_URL: first.binding, MECHANE_MODEL_UPSTREAM_KEY: second.binding };

    const resolvedOnce = await resolveRuntimeEnvironment({ environment });

    assert.deepEqual(resolvedOnce, {
      MECHANE_DATABASE_URL: 'postgres://first',
      MECHANE_MODEL_UPSTREAM_KEY: 'secret-upstream-key',
    });
    assert.equal(first.state.calls, 1);
    assert.equal(second.state.calls, 1);

    const resolvedTwice = await resolveRuntimeEnvironment({ environment });

    assert.deepEqual(resolvedTwice, {
      MECHANE_DATABASE_URL: 'postgres://first',
      MECHANE_MODEL_UPSTREAM_KEY: 'secret-upstream-key',
    });
    assert.equal(first.state.calls, 1);
    assert.equal(second.state.calls, 1);

    const freshState = { calls: 0 };

    const fresh = await resolveRuntimeEnvironment({
      environment: {
        MECHANE_DATABASE_URL: {
          get: async (): Promise<string> => {
            freshState.calls += 1;

            return 'postgres://fresh';
          },
        },
      },
    });

    assert.deepEqual(fresh, { MECHANE_DATABASE_URL: 'postgres://fresh' });
    assert.equal(freshState.calls, 1);

    const flakyState = { calls: 0 };

    const flakyBinding = {
      get: async (): Promise<string> => {
        flakyState.calls += 1;

        if (flakyState.calls === 1) {
          throw new Error('transient secrets store failure');
        }

        return 'recovered-secret';
      },
    };

    await assert.rejects(resolveRuntimeEnvironment({ environment: { MECHANE_SERVER_API_KEY: flakyBinding } }), {
      message: 'transient secrets store failure',
    });

    const recovered = await resolveRuntimeEnvironment({ environment: { MECHANE_SERVER_API_KEY: flakyBinding } });

    assert.deepEqual(recovered, { MECHANE_SERVER_API_KEY: 'recovered-secret' });
    assert.equal(flakyState.calls, EXPECTED_QUEUED_PAIR);
  },
);

void test(
  'managedUsageProjector batches all pending receipts into one control store connection in causal order',
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const session = createSession(new MemoryStorage());

    await session.commit(async (transaction) => {
      await registerManagedPrimary(transaction, primarySessionOpen());

      const baseMs = Date.now();

      await queueThreadUsage(
        transaction,
        { localId: SESSION_ID, sessionId: SESSION_ID, threadId: THREAD_ID, at: baseMs },
        true,
      );
      await queueThreadUsage(transaction, {
        localId: SESSION_ID,
        sessionId: SESSION_ID,
        threadId: THREAD_ID,
        at: baseMs + 1,
      });
      await queueSessionUsage(transaction, SESSION_ID);
    }, BACKGROUND_CONTEXT);

    const operations: Array<string> = [];
    const connections = { opened: 0 };

    const isReached = false;

    const usageSnapshot = {
      budget: null,
      reached: isReached,
      threadActiveSeconds: 1,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
        server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
        active_seconds: 1,
        list_cost: { amount: '0', currency: 'USD' as const },
      },
    };

    const flush = managedUsageProjector({
      harness: session,
      workspaceId: WORKSPACE_ID,
      withControl: async (operation) => {
        connections.opened += 1;

        const fakeStore = {
          recordManagedThreadActivity: async () => {
            operations.push('activity');
          },
          getManagedSessionUsage: async (scope: { readonly threadId?: string }) => {
            const label = Option.fromNullishOr(scope.threadId).pipe(
              Option.match({ onNone: () => 'session', onSome: () => 'thread' }),
            );

            operations.push(label);

            return usageSnapshot;
          },
        };

        return await operation(fakeStore);
      },
    });

    await flush(SESSION_ID);

    assert.equal(connections.opened, 1);
    assert.equal(operations.length, EXPECTED_RECEIPT_COUNT);
    assert.ok(operations.includes('activity'));
    assert.ok(operations.includes('thread'));
    assert.ok(operations.includes('session'));

    await flush(SESSION_ID);

    assert.equal(connections.opened, 1);
  },
);
