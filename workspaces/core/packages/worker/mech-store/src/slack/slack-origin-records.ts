import { SlackInboxOrigin } from '@mechane/records';
import type { InboxItemId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';

type SlackInboxItemInput = { readonly inboxItemId: InboxItemId };

const SlackOriginRow = Schema.Struct({ origin: Schema.fromJsonString(SlackInboxOrigin) });

type SlackOriginRow = typeof SlackOriginRow.Type;

type RecordSlackOriginInput = SlackInboxItemInput & { readonly origin: SlackInboxOrigin };

/** Immutable trusted origins attached to admitted inbox items. */
export function slackOriginRecords({ sql }: RecordsInput) {
  return {
    slackInboxOrigin: (input: SlackInboxItemInput): Option.Option<SlackInboxOrigin> =>
      slackInboxOrigin({ sql, ...input }),
    recordSlackInboxOrigin: (input: RecordSlackOriginInput): void => recordSlackInboxOrigin({ sql, ...input }),
  };
}

function slackInboxOrigin({ sql, inboxItemId }: SqlCall<SlackInboxItemInput>): Option.Option<SlackInboxOrigin> {
  const cursor = sql.exec('SELECT origin FROM slack_inbox_origins WHERE inbox_item_id = ?', inboxItemId);

  const row = decodeFirst({ cursor, schema: SlackOriginRow });

  return Option.map(row, ({ origin }) => origin);
}

function recordSlackInboxOrigin({ sql, inboxItemId, origin }: SqlCall<RecordSlackOriginInput>): void {
  const wire = Schema.fromJsonString(SlackInboxOrigin);
  const serialized = Schema.encodeSync(wire)(origin);

  sql.exec(
    'INSERT INTO slack_inbox_origins (inbox_item_id, origin) VALUES (?, ?) ON CONFLICT (inbox_item_id) DO NOTHING',
    inboxItemId,
    serialized,
  );
}
