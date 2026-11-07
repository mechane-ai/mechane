import { InboxItem, Mech, Trace, Turn, TurnPage, TurnStatus } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { Account } from './auth/types.ts';
import { runCli } from './cli/run-cli.ts';
import { waitFor } from './wait-for.ts';

type MechOwner = { readonly stack: LocalStack; readonly account: Account };

type MechInput = MechOwner & { readonly mechId: string };
type CreateMechInput = MechOwner & { readonly name: string; readonly dailyCapMicros?: number };
type SendInboxInput = MechInput & { readonly text: string; readonly inboxItemId?: string; readonly sessionId?: string };
type TraceInput = MechInput & { readonly turnId: string };
type WaitForTurnInput = MechInput & { readonly inboxItemId: string };

type ReadInput<Output extends Schema.Codec<unknown, unknown>> = MechOwner & {
  readonly path: string;
  readonly schema: Output;
};

const READ_DEADLINE_MS = 30_000;

export async function createMech({ stack, account, name, dailyCapMicros }: CreateMechInput): Promise<Mech> {
  const args = ['mech', 'create', '--workspace', account.workspaceId, '--name', name];

  if (dailyCapMicros !== undefined) {
    args.push('--daily-cap-micros', String(dailyCapMicros));
  }

  return await runCli({ stack, account, args, schema: Mech });
}

export async function sendInbox({
  stack,
  account,
  mechId,
  text,
  inboxItemId = randomUUID(),
  sessionId,
}: SendInboxInput): Promise<InboxItem> {
  const args = ['inbox', 'send', mechId, text, '--workspace', account.workspaceId, '--inbox-item-id', inboxItemId];

  if (sessionId !== undefined) {
    args.push('--session-id', sessionId);
  }

  return await runCli({ stack, account, args, schema: InboxItem });
}

export async function sendInboxAndWait(input: SendInboxInput): Promise<Turn> {
  const sent = await sendInbox(input);

  return await waitForTurn({ ...input, inboxItemId: sent.id });
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

export async function readTrace(input: TraceInput): Promise<Trace> {
  const path = turnPath(input);

  return await readJson({ ...input, path, schema: Trace });
}

export async function waitForTurn(input: WaitForTurnInput): Promise<Turn> {
  const turns = await waitFor({
    name: 'the admitted input to finish',
    read: () => readTurns(input),
    accept: (items) =>
      items.some((turn) => turn.inboxItemIds.some((id) => id === input.inboxItemId) && isFinished(turn)),
  });

  const turn = turns.find(
    (candidate) => candidate.inboxItemIds.some((id) => id === input.inboxItemId) && isFinished(candidate),
  );

  if (turn === undefined) {
    throw new Error('The completed input has no run');
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
}: ReadInput<Output>): Promise<Output['Type']> {
  const response = await fetch(new URL(path, stack.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}` },
    signal: AbortSignal.timeout(READ_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`The run read returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(schema)(await response.json());
}

const TERMINAL_TURN_STATUSES: ReadonlySet<string> = new Set([TurnStatus.Answered, TurnStatus.Unanswered]);

function isFinished(turn: Turn): boolean {
  return TERMINAL_TURN_STATUSES.has(turn.status);
}

function turnsPath(input: MechInput): string {
  return `${mechPath(input)}/turns`;
}

function turnPath(input: TraceInput): string {
  return `${mechPath(input)}/turns/${encodeURIComponent(input.turnId)}`;
}
