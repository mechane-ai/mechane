import {
  ConsoleMessagePage,
  EventPage,
  Mech,
  MechHistoryPage,
  NotificationReceipt,
  Trace,
  Turn,
  TurnPage,
  TurnStatus,
} from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { createAccount } from './auth/create-account.ts';
import type { Account } from './auth/types.ts';
import { runCli } from './cli/run-cli.ts';
import { waitFor } from './wait-for.ts';

type MechOwner = { readonly stack: LocalStack; readonly account: Account };

type MechInput = MechOwner & { readonly mechId: string };
type CreateMechInput = MechOwner & { readonly name: string; readonly dailyCapMicros?: number };
type SendNotificationInput = MechInput & { readonly text: string; readonly notificationId?: string };
type TraceInput = MechInput & { readonly turnId: string; readonly signal?: AbortSignal };
type EventsInput = MechInput & { readonly after?: number };
type HistoryInput = MechInput & { readonly after?: string };
type AfterQuery = { readonly after?: string | number };
type WaitForTurnInput = MechInput & { readonly notificationId: string };

type ReadInput<Output extends Schema.Codec<unknown, unknown>> = MechOwner & {
  readonly path: string;
  readonly schema: Output;
  readonly signal?: AbortSignal;
};

const READ_DEADLINE_MS = 30_000;

export async function createMech({ stack, account, name, dailyCapMicros }: CreateMechInput): Promise<Mech> {
  const args = ['mech', 'create', '--workspace', account.workspaceId, '--name', name];

  if (dailyCapMicros !== undefined) {
    args.push('--daily-cap-micros', String(dailyCapMicros));
  }

  return await runCli({ stack, account, args, schema: Mech });
}

export async function createMechContext({
  stack,
  name,
}: {
  readonly stack: LocalStack;
  readonly name: string;
}): Promise<MechInput> {
  const account = await createAccount({ stack });
  const mech = await createMech({ stack, account, name });

  return { stack, account, mechId: mech.id };
}

export async function sendNotification({
  stack,
  account,
  mechId,
  text,
  notificationId = randomUUID(),
}: SendNotificationInput): Promise<NotificationReceipt> {
  const args = [
    'notification',
    'send',
    mechId,
    text,
    '--workspace',
    account.workspaceId,
    '--notification-id',
    notificationId,
  ];

  return await runCli({ stack, account, args, schema: NotificationReceipt });
}

export async function sendNotificationAndWait(input: SendNotificationInput): Promise<Turn> {
  const sent = await sendNotification(input);

  return await waitForTurn({ ...input, notificationId: sent.id });
}

export async function readTurns(input: MechInput): Promise<ReadonlyArray<Turn>> {
  const path = turnsPath(input);
  const page = await readJson({ ...input, path, schema: TurnPage });
  const turns: Array<Turn> = [];

  for (const turn of page.turns) {
    if (!Schema.is(Turn)(turn)) {
      throw new Error('The deployment returned an unrecognized run status');
    }

    turns.push(turn);
  }

  return turns;
}

export async function readConsoleMessages(input: MechInput): Promise<ConsoleMessagePage> {
  return await readJson({ ...input, path: conversationPath(input), schema: ConsoleMessagePage });
}

export async function readEvents(input: EventsInput): Promise<EventPage> {
  return await readJson({ ...input, path: eventsPath(input), schema: EventPage });
}

export async function readHistoryPage(input: HistoryInput): Promise<MechHistoryPage> {
  return await readJson({ ...input, path: historyPath(input), schema: MechHistoryPage });
}

export async function readTrace(input: TraceInput): Promise<Trace> {
  const path = turnPath(input);

  return await readJson({ ...input, path, schema: Trace });
}

export async function waitForTurn(input: WaitForTurnInput): Promise<Turn> {
  return await waitForRunState({ ...input, name: 'the notification activation to finish', accept: isFinished });
}

export async function waitForActiveTurn(input: WaitForTurnInput): Promise<Turn> {
  return await waitForRunState({
    ...input,
    name: 'the notification activation to become active',
    accept: (turn) => turn.status === TurnStatus.Running,
  });
}

type WaitForRunStateInput = WaitForTurnInput & { readonly name: string; readonly accept: (turn: Turn) => boolean };

async function waitForRunState(input: WaitForRunStateInput): Promise<Turn> {
  const turns = await waitFor({
    name: input.name,
    read: () => readTurns(input),
    accept: (items) =>
      items.some((turn) => turn.notificationIds.some((id) => id === input.notificationId) && input.accept(turn)),
  });

  const turn = turns.find(
    (candidate) => candidate.notificationIds.some((id) => id === input.notificationId) && input.accept(candidate),
  );

  if (turn === undefined) {
    throw new Error('The completed notification has no activation');
  }

  return turn;
}

export function mechPath({ account, mechId }: Pick<MechInput, 'account' | 'mechId'>): string {
  return `/api/v1/workspaces/${encodeURIComponent(account.workspaceId)}/mechs/${encodeURIComponent(mechId)}`;
}

async function readJson<Output extends Schema.Codec<unknown, unknown>>({
  stack,
  account,
  path,
  schema,
  signal,
}: ReadInput<Output>): Promise<Output['Type']> {
  const response = await fetch(new URL(path, stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}` },
    signal: signal ?? AbortSignal.timeout(READ_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`The runtime read ${path} returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(schema)(await response.json());
}

const TERMINAL_TURN_STATUSES: ReadonlySet<string> = new Set([
  TurnStatus.Completed,
  TurnStatus.Failed,
  TurnStatus.Stopped,
]);

function isFinished(turn: Turn): boolean {
  return TERMINAL_TURN_STATUSES.has(turn.status);
}

function turnsPath(input: MechInput): string {
  return `${mechPath(input)}/turns`;
}

function conversationPath(input: MechInput): string {
  return `${mechPath(input)}/conversation`;
}

export function eventsPath(input: EventsInput): string {
  const query = afterQuery(input);

  return `${mechPath(input)}/events${query}`;
}

export function historyPath(input: HistoryInput): string {
  const query = afterQuery(input);

  return `${mechPath(input)}/history${query}`;
}

function afterQuery({ after }: AfterQuery): string {
  if (after === undefined) {
    return '';
  }

  return `?after=${encodeURIComponent(after)}`;
}

export function turnPath(input: TraceInput): string {
  return `${mechPath(input)}/turns/${encodeURIComponent(input.turnId)}`;
}
