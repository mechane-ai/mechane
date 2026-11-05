import { TurnToolCall } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import type { FoundTurn, TurnInput, TurnReading } from '@mechane/rpc';
import { Match, Schema } from 'effect';
import type { OpenedMech } from '../types.ts';
import { readTurn } from './read-turn.ts';

const EVIDENCE_MAX_INPUTS = 4;

type ReadTurnTraceInput = TurnInput & { readonly mech: OpenedMech };

/** Only display metadata crosses this boundary; raw transcripts remain in the owning harness. */
export async function readTurnTrace({ mech, turnId }: ReadTurnTraceInput): Promise<TurnReading> {
  const reading = await mech.store.atomic({ run: (store) => readTurn({ store, turnId }) });

  return await Match.valueTags(reading, {
    Found: (found) => readTurnToolSteps({ mech, reading: found }),
    MechMissing: () => reading,
    TurnMissing: () => reading,
  });
}

type TurnToolStepsInput = { readonly mech: OpenedMech; readonly reading: FoundTurn };

async function readTurnToolSteps({ mech, reading }: TurnToolStepsInput): Promise<TurnReading> {
  const inputs = reading.turn.inboxItemIds.slice(0, EVIDENCE_MAX_INPUTS);

  const pending = inputs.map((id) => {
    const inboxItemId = InboxItemId.make(id);

    return mech.harness.readTurnEvidence({ inboxItemId });
  });

  const evidence = await Promise.all(pending);

  const calls = evidence.flatMap((segment) => segment.toolCalls);
  const entries = calls.map((call) => [call.id, call] as const);
  const unique = new Map(entries);

  const toolCalls = [...unique.values()].map(({ id, name, status, startedAt, endedAt }) =>
    Schema.encodeSync(TurnToolCall)({ id, name, status, startedAt, endedAt }),
  );

  const evidenceNotices = evidence.flatMap((segment) => segment.unknowns);

  if (reading.turn.inboxItemIds.length > EVIDENCE_MAX_INPUTS) {
    return {
      ...reading,
      toolCalls,
      evidenceNotices: [...evidenceNotices, 'Additional joined inputs are outside this evidence page.'],
    };
  }

  return { ...reading, toolCalls, evidenceNotices };
}
