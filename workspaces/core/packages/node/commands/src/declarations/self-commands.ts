import { ConsoleMessageId, NotificationText, WakeId } from '@mechane/protocol';
import { DurationFromSeconds, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

const WAKE_ARGUMENT = { name: 'wake-id', summary: 'the durable wake receipt to inspect or cancel' } as const;
const positiveSeconds = Schema.isGreaterThan(0);
const PositiveSeconds = Schema.Int.check(positiveSeconds);
const SecondsText = Schema.NumberFromString.pipe(Schema.decodeTo(PositiveSeconds));
const WakeDelay = SecondsText.pipe(Schema.decodeTo(DurationFromSeconds));

const ScheduleInput = renamedWireStruct({
  fields: {
    text: NotificationText,
    wakeId: Schema.optionalKey(WakeId),
    after: Schema.optionalKey(WakeDelay),
    at: Schema.optionalKey(Schema.DateTimeUtcFromString),
  },
  renames: { wakeId: 'wake-id', after: 'after-seconds' },
});

const WakeInput = renamedWireStruct({ fields: { wakeId: WakeId }, renames: { wakeId: 'wake-id' } });
const WakeQuery = Schema.Struct({ after: Schema.OptionFromOptionalKey(WakeId) });

const MessageInput = renamedWireStruct({
  fields: { text: NotificationText, messageId: Schema.optionalKey(ConsoleMessageId) },
  renames: { messageId: 'message-id' },
});

export const SELF_COMMANDS = {
  'self wake schedule': {
    summary: 'persist a wake for this mech and return its receipt immediately',
    shape: CommandShape.Document,
    operations: ['scheduleSelfWake'],
    flags: {
      'wake-id': { kind: FlagKind.Text, summary: 'reuse this identity to retry the same schedule' },
      'after-seconds': {
        kind: FlagKind.Text,
        summary: 'wake after this many seconds, resolved once on first acceptance',
      },
      'at': { kind: FlagKind.Text, summary: 'wake at this RFC 3339 time; use exactly one deadline flag' },
    },
    arguments: [{ name: 'text', summary: 'the notification delivered to this mech at the deadline' }],
    input: ScheduleInput,
  },
  'self wake show': {
    summary: 'show one wake receipt for this mech',
    shape: CommandShape.Document,
    operations: ['showSelfWake'],
    flags: {},
    arguments: [WAKE_ARGUMENT],
    input: WakeInput,
  },
  'self wake list': {
    summary: 'list wake receipts for this mech',
    shape: CommandShape.Document,
    operations: ['listSelfWakes'],
    flags: { after: { kind: FlagKind.Text, summary: 'continue after this wake receipt from the previous page' } },
    arguments: [],
    input: WakeQuery,
  },
  'self wake cancel': {
    summary: 'cancel a wake or return its already delivered receipt',
    shape: CommandShape.Document,
    operations: ['cancelSelfWake'],
    flags: {},
    arguments: [WAKE_ARGUMENT],
    input: WakeInput,
  },
  'self message': {
    summary: 'explicitly publish a Console message from this mech',
    shape: CommandShape.Document,
    operations: ['publishSelfMessage'],
    flags: { 'message-id': { kind: FlagKind.Text, summary: 'reuse this identity to retry the same publication' } },
    arguments: [{ name: 'text', summary: 'the public message text' }],
    input: MessageInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
