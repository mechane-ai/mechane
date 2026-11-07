import { REPLY_EXCERPT_MAX_CHARS } from '@mechane/protocol';
import type { ActivityEvent, Mech, MechRevision, Run, SpendReservation } from '../../domain.ts';

const INPUT_EXCERPT_LENGTH = 320;

export function mechSummary(mech: Mech) {
  return {
    id: mech.id,
    name: mech.name,
    model: mech.model,
    revision: mech.revision,
    status: mech.status,
    creator_id: mech.creatorId,
    created_at: mech.createdAt,
    forked_from: forkRecord(mech.forkedFrom),
  };
}

function forkRecord(point: Mech['forkedFrom']) {
  if (point === null) {
    return null;
  }

  return { mech_id: point.mechId, sequence: point.sequence };
}

export function mechRecord(mech: Mech, activeRevision: number = mech.revision) {
  return {
    ...mechSummary(mech),
    instructions: mech.instructions,
    daily_cap_micros: mech.dailyCapMicros,
    active_revision: activeRevision,
    updated_at: mech.updatedAt,
    updater_id: mech.updaterId,
  };
}

export function revisionRecord(revision: MechRevision) {
  return {
    revision: revision.revision,
    name: revision.name,
    model: revision.model,
    instructions: revision.instructions,
    daily_cap_micros: revision.dailyCapMicros,
    status: revision.status,
    updated_at: revision.updatedAt,
    updater_id: revision.updaterId,
  };
}

export function runRecord(run: Run) {
  const runFields = {
    id: run.id,
    version: run.version,
    session_id: run.sessionId,
    inbox_item_ids: [run.inputId],
    created_at: run.createdAt,
    started_at: run.startedAt,
    definition_revision: run.definitionRevision,
    input_excerpt: run.inputText.slice(0, INPUT_EXCERPT_LENGTH),
  };

  switch (run.status) {
    case 'queued':
    case 'running':
    case 'waiting':
      return { ...runFields, status: run.status };
    case 'completed':
      return { ...runFields, status: 'answered', ended_at: run.endedAt };
    case 'failed':
      return { ...runFields, status: 'unanswered', ended_at: run.endedAt, reason: run.failureReason ?? 'faulted' };
    case 'cancelled':
      return { ...runFields, status: 'unanswered', ended_at: run.endedAt, reason: 'canceled' };
  }
}

export function dispatchRecord(reservation: SpendReservation) {
  const dispatchFields = {
    id: reservation.id,
    model: reservation.model,
    requested_micros: reservation.reservedMicros,
    decided_at: reservation.createdAt,
    status: reservation.state,
  };

  if (reservation.state !== 'settled') {
    return dispatchFields;
  }

  const settled = { ...dispatchFields, settled_micros: reservation.settledMicros, settled_at: reservation.settledAt };

  if (reservation.usage === null) {
    return { ...settled, basis: 'reservation' };
  }

  return {
    ...settled,
    basis: 'usage',
    input_tokens: reservation.usage.inputTokens,
    output_tokens: reservation.usage.outputTokens,
    cache_read_tokens: reservation.usage.cacheReadTokens,
    cache_write_tokens: reservation.usage.cacheWriteTokens,
  };
}

function sourceRecord(source: unknown) {
  if (typeof source !== 'object' || source === null) {
    return;
  }

  if (!('channelId' in source) || !('teamId' in source)) {
    return;
  }

  if (!('messageTimestamp' in source) || !('userId' in source)) {
    return;
  }

  return {
    channel_id: source.channelId,
    team_id: source.teamId,
    message_timestamp: source.messageTimestamp,
    user_id: source.userId,
  };
}

export function activityRecord(event: ActivityEvent) {
  const eventFields = { type: event.type, sequence: event.sequence, occurred_at: event.createdAt };
  const payload = event.payload;

  switch (event.type) {
    case 'inbox_item.received': {
      const record = {
        ...eventFields,
        inbox_item_id: payload['inboxItemId'],
        sender_id: payload['senderId'] ?? null,
        text: payload['text'],
        delivery: 'when_idle',
      };

      const source = sourceRecord(payload['source']);

      if (source === undefined) {
        return record;
      }

      return { ...record, source };
    }
    case 'turn.started':
      return { ...eventFields, turn_id: event.runId, inbox_item_ids: payload['inboxItemIds'] };
    case 'turn.canceled':
      return { ...eventFields, turn_id: event.runId, canceler_id: payload['cancelerId'] };
    case 'turn.answered':
      return { ...eventFields, turn_id: event.runId, reply: payload['reply'] };
    case 'turn.unanswered':
      return { ...eventFields, turn_id: event.runId, reason: payload['reason'] };
    case 'mech.forked': {
      const point = payload['forkedFrom'];

      if (typeof point !== 'object' || point === null) {
        throw new Error('The fork event has no source point.');
      }

      if (!('mechId' in point) || !('sequence' in point)) {
        throw new Error('The fork event has no source point.');
      }

      return { ...eventFields, forked_from: { mech_id: point.mechId, sequence: point.sequence } };
    }
    default:
      return eventFields;
  }
}

export function replyExcerpt(run: Run, events: ReadonlyArray<ActivityEvent>) {
  const replyEvent = events.find((event) => event.type === 'turn.answered');

  if (run.reply === null || replyEvent === undefined) {
    return;
  }

  return {
    sequence: replyEvent.sequence,
    text: run.reply.slice(0, REPLY_EXCERPT_MAX_CHARS),
    truncated: run.reply.length > REPLY_EXCERPT_MAX_CHARS,
  };
}
