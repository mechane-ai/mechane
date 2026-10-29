import { SlackBinding } from '@mechane/protocol';
import type { SlackBindingResult } from '@mechane/protocol';
import type { SlackBindingId, SlackChannelId, SlackConnectionId, SlackTeamId } from '@mechane/records';
import { InboxItemId, SHA256_PATTERN, SlackEventId, wireStruct } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { configureSlackBinding } from './configure-slack-binding.ts';
import { SerializedSlackBinding, SlackBindingRow } from './schemas.ts';
import type { ConfigureSlackBindingInput } from './types.ts';

type SlackRouteInput = {
  readonly connectionId: SlackConnectionId;
  readonly teamId: SlackTeamId;
  readonly channelId: SlackChannelId;
};

const SlackEventRow = wireStruct({
  fields: {
    eventId: SlackEventId,
    inboxItemId: InboxItemId,
    fingerprint: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
    binding: Schema.fromJsonString(SlackBinding),
  },
});

type SlackEventRow = typeof SlackEventRow.Type;

type SlackEventIdInput = SlackRouteInput & { readonly eventId: SlackEventId; readonly messageTimestamp: string };

type SlackBindingIdInput = { readonly bindingId: SlackBindingId };

type RecordSlackEventInput = SlackEventIdInput & SlackEventRow;

/** Workspace-owned channel bindings and durable event deduplication records. */
export function slackRecords({ sql }: RecordsInput) {
  return {
    configureSlackBinding: (input: ConfigureSlackBindingInput): SlackBindingResult =>
      configureSlackBinding({ sql, ...input }),
    slackBindings: (): ReadonlyArray<SlackBinding> => slackBindings({ sql }),
    slackBinding: (input: SlackBindingIdInput): Option.Option<SlackBinding> => slackBinding({ sql, ...input }),
    slackRoute: (input: SlackRouteInput): Option.Option<SlackBinding> => slackRoute({ sql, ...input }),
    slackEvent: (input: SlackEventIdInput): Option.Option<SlackEventRow> => slackEvent({ sql, ...input }),
    recordSlackEvent: (input: RecordSlackEventInput): void => recordSlackEvent({ sql, ...input }),
  };
}

function slackBindings({ sql }: RecordsInput): ReadonlyArray<SlackBinding> {
  const cursor = sql.exec('SELECT binding FROM slack_bindings ORDER BY id');

  return decodeRows({ cursor, schema: SlackBindingRow }).map(({ binding }) => binding);
}

function slackBinding({ sql, bindingId }: SqlCall<SlackBindingIdInput>): Option.Option<SlackBinding> {
  const cursor = sql.exec('SELECT binding FROM slack_bindings WHERE id = ?', bindingId);

  const row = decodeFirst({ cursor, schema: SlackBindingRow });

  return Option.map(row, ({ binding }) => binding);
}

function slackRoute({ sql, connectionId, teamId, channelId }: SqlCall<SlackRouteInput>): Option.Option<SlackBinding> {
  const cursor = sql.exec(
    'SELECT binding FROM slack_bindings WHERE connection_id = ? AND team_id = ? AND channel_id = ?',
    connectionId,
    teamId,
    channelId,
  );

  const row = decodeFirst({ cursor, schema: SlackBindingRow });

  return Option.map(row, ({ binding }) => binding);
}

function slackEvent({
  sql,
  connectionId,
  eventId,
  teamId,
  channelId,
  messageTimestamp,
}: SqlCall<SlackEventIdInput>): Option.Option<SlackEventRow> {
  const cursor = sql.exec(
    'SELECT event_id, inbox_item_id, fingerprint, binding FROM slack_events WHERE connection_id = ? AND (event_id = ? OR (team_id = ? AND channel_id = ? AND message_timestamp = ?)) LIMIT 1',
    connectionId,
    eventId,
    teamId,
    channelId,
    messageTimestamp,
  );

  return decodeFirst({ cursor, schema: SlackEventRow });
}

function recordSlackEvent({
  sql,
  connectionId,
  eventId,
  teamId,
  channelId,
  messageTimestamp,
  inboxItemId,
  fingerprint,
  binding,
}: SqlCall<RecordSlackEventInput>): void {
  const serialized = Schema.encodeSync(SerializedSlackBinding)(binding);

  sql.exec(
    'INSERT INTO slack_events (connection_id, event_id, team_id, channel_id, message_timestamp, inbox_item_id, fingerprint, binding) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    connectionId,
    eventId,
    teamId,
    channelId,
    messageTimestamp,
    inboxItemId,
    fingerprint,
    serialized,
  );
}
