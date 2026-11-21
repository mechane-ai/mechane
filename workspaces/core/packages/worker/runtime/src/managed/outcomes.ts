import type { Draft } from '@earendil-works/chord/delta';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { configure, defineDocFamily } from '@earendil-works/pi-durable';
import type { ConversationId, Tx, UserInput } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { actorRecordCollection } from '../actor/record-store.ts';
import type { ManagedInputEvent } from './event-log/inputs.ts';
import { appendManagedEvent, markManagedProjection, readManagedEvent } from './event-log/write.ts';
import { transition } from './lifecycle.ts';
import { gradingInput } from './outcome-evidence.ts';
import { graderInstructions, gradeUsage, gradeVerdict } from './outcome-grader.ts';
import type { ManagedEvent } from './protocol.ts';
import { inputKey, queueInput, sessionState, ThreadInputs } from './scheduler.ts';

type Definition = Extract<ManagedInputEvent, { readonly type: 'user.define_outcome' }>;

const Projection = Schema.Struct({
  type: Schema.Literal('outcome_evaluation'),
  outcome_id: Schema.String,
  description: Schema.String,
  result: Schema.Literals([
    'pending',
    'running',
    'evaluating',
    'satisfied',
    'max_iterations_reached',
    'failed',
    'interrupted',
  ]),
  iteration: Schema.Int,
  completed_at: Schema.NullOr(Schema.String),
  explanation: Schema.NullOr(Schema.String),
});

type Projection = typeof Projection.Type;

export function outcomeRecords(id: string) {
  return actorRecordCollection(`managed-outcomes:${id}`, Projection);
}

const MaxIterations = 20;
const DefaultIterations = 3;
const HeartbeatMs = 30_000;
const MaxEvidenceReads = 16;

type Evaluation = {
  readonly definitionId: string;
  readonly summary: Projection | null;
  readonly startId: string;
  readonly answerId: string;
  readonly heartbeat: number;
  readonly evidence: ReadonlyArray<string>;
};

const Evaluation = defineDocFamily<Draft<Evaluation>, null>({
  kind: 'managed.outcome',
  scope: 'session',
  version: 1,
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ definitionId: '', summary: null, startId: '', answerId: '', heartbeat: 0, evidence: [] }),
});

const Graders = defineDocFamily<{ readonly startId: string; readonly conversation: ConversationId | null }, null>({
  kind: 'managed.outcome-grader',
  scope: 'session',
  version: 1,
  family: true,
  checkpointWhen: () => true,
  initial: () => ({ startId: '', conversation: null }),
});

async function save(transaction: Tx, id: string, value: Projection) {
  const work = await transaction.doc(Evaluation, id, null);
  work.summary = { ...value };

  await outcomeRecords(id).put(transaction, value.outcome_id, value);
  await markManagedProjection(transaction, id);
}

export function validateManagedOutcome(event: Definition) {
  if (event.rubric.type !== 'text') {
    return failManagedRequest(HttpStatusCode.BadRequest, 'Self-hosted outcomes require an inline text rubric');
  }

  const max = event.max_iterations ?? DefaultIterations;

  if (max < 1 || max > MaxIterations) {
    return failManagedRequest(HttpStatusCode.BadRequest, 'max_iterations must be between 1 and 20');
  }
}

export async function defineManagedOutcome(transaction: Tx, id: string, event: Definition) {
  validateManagedOutcome(event);

  const work = await transaction.doc(Evaluation, id, null);

  if (work.summary !== null && work.summary.completed_at === null) {
    return failManagedRequest(
      HttpStatusCode.Conflict,
      'Interrupt or finish the active outcome before defining another',
    );
  }

  const outcomeId = `outc_${crypto.randomUUID().replaceAll('-', '')}`;

  const accepted = await appendManagedEvent(
    transaction,
    { sessionId: id },
    { ...event, outcome_id: outcomeId, max_iterations: event.max_iterations ?? null },
  );

  Object.assign(work, { definitionId: accepted.id, startId: '', answerId: '', heartbeat: 0, evidence: [] });
  await save(transaction, id, {
    type: 'outcome_evaluation',
    outcome_id: outcomeId,
    description: event.description,
    iteration: 0,
    result: 'pending',
    completed_at: null,
    explanation: null,
  });
  await queueInput(transaction, id, accepted.id);

  const state = await sessionState(transaction, id);

  if (state.waiting === null && state.interrupt === null) {
    await transition(transaction, { sessionId: id, status: 'running' });
  }

  return accepted;
}

export async function recordManagedOutcomeEvidence(
  transaction: Tx,
  id: string,
  { call, result }: { readonly call: ManagedEvent; readonly result: ManagedEvent },
) {
  const isFileRead = call.type === 'agent.tool_use' && call['name'] === 'read';
  const isSuccessfulResult = result.type === 'user.tool_result' && result['is_error'] !== true;

  if (!isFileRead || !isSuccessfulResult) {
    return;
  }

  const work = await transaction.doc(Evaluation, id, null);

  if (work.summary?.result !== 'running') {
    return;
  }

  work.evidence = [...work.evidence.slice(1 - MaxEvidenceReads), result.id];
}

export async function managedOutcomeConversation(transaction: Tx, state: Awaited<ReturnType<typeof sessionState>>) {
  if (state.conversation === null) {
    throw new Error('Missing native conversation');
  }

  const grader = await transaction.doc(Graders, state.id, null);

  if (grader.conversation === null) {
    return state.conversation;
  }

  let eventId = state.activeEvent;

  if (eventId === null && state.pendingHead < state.pendingTail) {
    const queuedInput = await transaction.doc(ThreadInputs, inputKey(state.id, state.pendingHead), null);
    eventId = queuedInput.eventId;
  }

  if (grader.startId === eventId) {
    return grader.conversation;
  }

  return state.conversation;
}

const DefinitionFields = Schema.Struct({
  rubric: Schema.Struct({ type: Schema.Literal('text'), content: Schema.String }),
  max_iterations: Schema.NullOr(Schema.Int),
});

function parseDefinition(event: ManagedEvent | undefined) {
  return Schema.decodeUnknownSync(DefinitionFields, { onExcessProperty: 'error' })({
    rubric: event?.['rubric'],
    max_iterations: event?.['max_iterations'],
  });
}

const outcomeEventTypes: ReadonlySet<string> = new Set([
  'user.define_outcome',
  'span.outcome_evaluation_start',
  'span.outcome_evaluation_end',
]);

export async function outcomeInput(
  transaction: Tx,
  id: string,
  event: ManagedEvent,
): Promise<UserInput | null | undefined> {
  if (!outcomeEventTypes.has(event.type)) {
    return undefined;
  }

  const work = await transaction.doc(Evaluation, id, null);
  const current = work.summary;

  if (current === null || current.outcome_id !== event['outcome_id']) {
    return null;
  }

  if (event.type === 'span.outcome_evaluation_end' && event['result'] === 'max_iterations_reached') {
    return `The evaluation budget is exhausted. Briefly report the remaining gap to the user. ${current.explanation}`;
  }

  if (current.completed_at !== null) {
    return null;
  }

  const definition = await readManagedEvent(transaction, id, work.definitionId);
  const rubric = parseDefinition(definition).rubric.content;

  if (event.type === 'span.outcome_evaluation_start') {
    return await gradingInput(transaction, id, { work, description: current.description, rubric });
  }

  await save(transaction, id, { ...current, result: 'running' });

  if (event.type === 'span.outcome_evaluation_end') {
    return `Revise the deliverable using the evaluator feedback. Read back updated file deliverables for grading.\n${current.explanation}`;
  }

  return `Produce this deliverable. Return text artifacts in your response. Read back file deliverables for the evaluator.\n${JSON.stringify(
    { task: current.description, rubric },
  )}`;
}

type Result = 'satisfied' | 'needs_revision' | 'max_iterations_reached' | 'failed' | 'interrupted';

const feedbackResults: ReadonlySet<Result> = new Set(['needs_revision', 'max_iterations_reached']);

async function endEvaluation(
  transaction: Tx,
  id: string,
  {
    result,
    explanation,
    usage,
  }: { readonly result: Result; readonly explanation: string; readonly usage: ReturnType<typeof gradeUsage> },
) {
  const work = await transaction.doc(Evaluation, id, null);
  const current = work.summary;

  if (current === null || current.completed_at !== null) {
    return;
  }

  if (work.startId === '') {
    if (result !== 'needs_revision') {
      await save(transaction, id, { ...current, result, completed_at: new Date().toISOString(), explanation });
    }

    return;
  }

  const end = await appendManagedEvent(
    transaction,
    { sessionId: id },
    {
      type: 'span.outcome_evaluation_end',
      outcome_id: current.outcome_id,
      outcome_evaluation_start_id: work.startId,
      iteration: current.iteration,
      result,
      explanation,
      usage,
    },
  );

  if (result === 'needs_revision') {
    work.startId = '';
    work.evidence = [];

    await save(transaction, id, { ...current, result: 'running', iteration: current.iteration + 1, explanation });
  } else {
    await save(transaction, id, { ...current, result, completed_at: end.processed_at, explanation });
  }

  if (feedbackResults.has(result)) {
    await queueInput(transaction, id, end.id);
  }
}

export async function interruptManagedOutcome(transaction: Tx, id: string) {
  await endEvaluation(transaction, id, {
    result: 'interrupted',
    explanation: 'The user interrupted this outcome.',
    usage: gradeUsage([]),
  });
}

export async function managedGraderHeartbeat(transaction: Tx, id: string, active: string | null) {
  const work = await transaction.doc(Evaluation, id, null);
  const current = work.summary;

  if (current?.result !== 'evaluating' || work.startId !== active || Date.now() - work.heartbeat < HeartbeatMs) {
    return;
  }

  await appendManagedEvent(
    transaction,
    { sessionId: id },
    { type: 'span.outcome_evaluation_ongoing', outcome_id: current.outcome_id, iteration: current.iteration },
  );

  work.heartbeat = Date.now();
}

export async function completeManagedOutcomeTurn(
  transaction: Tx,
  id: string,
  input: {
    readonly active: ManagedEvent;
    readonly answers: ReadonlyArray<AssistantMessage>;
    readonly answerId?: string | undefined;
    readonly hasFailed: boolean;
    readonly wasInterrupted: boolean;
  },
) {
  const work = await transaction.doc(Evaluation, id, null);
  const current = work.summary;

  if (current === null || current.completed_at !== null || input.wasInterrupted) {
    return;
  }

  const state = await sessionState(transaction, id);

  if (input.active.type === 'span.outcome_evaluation_start') {
    if (current.result !== 'evaluating' || work.startId !== input.active.id) {
      return;
    }

    const verdict = gradeVerdict(input);
    const definition = parseDefinition(await readManagedEvent(transaction, id, work.definitionId));
    const limit = definition.max_iterations ?? DefaultIterations;
    let result: Result = verdict.result;

    if (result === 'needs_revision' && current.iteration + 1 >= limit) {
      result = 'max_iterations_reached';
    }

    await endEvaluation(transaction, id, {
      result,
      explanation: verdict.explanation,
      usage: gradeUsage(input.answers),
    });

    return;
  }

  if (current.result !== 'running') {
    return;
  }

  if (input.hasFailed) {
    await endEvaluation(transaction, id, {
      result: 'failed',
      explanation: 'The working agent could not complete its turn.',
      usage: gradeUsage([]),
    });

    return;
  }

  if (input.answerId !== undefined) {
    work.answerId = input.answerId;
  }

  if (state.pendingHead < state.pendingTail) {
    return;
  }

  const grader = await transaction.createConversation({ ownership: { kind: 'ownerless' } });

  await configure(transaction, grader.id, {
    model: { provider: 'mechane', modelId: state.model },
    instructions: graderInstructions,
    tools: [],
    modelTools: [],
    extensions: [],
    maxTurns: 1,
  });

  const start = await appendManagedEvent(
    transaction,
    { sessionId: id },
    { type: 'span.outcome_evaluation_start', outcome_id: current.outcome_id, iteration: current.iteration },
  );

  Object.assign(work, { startId: start.id, heartbeat: Date.now() });

  const record = await transaction.doc(Graders, id, null);
  record.startId = start.id;
  record.conversation = grader.id;

  await save(transaction, id, { ...current, result: 'evaluating' });
  await queueInput(transaction, id, start.id);
}
