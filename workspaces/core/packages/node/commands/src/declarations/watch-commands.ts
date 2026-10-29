import {
  InboxText,
  WATCH_DEFAULT_CHECK_TIME,
  WATCH_MIN_INTERVAL,
  WatchCheckSeconds,
  WatchIntervalSeconds,
  WatchName,
  WatchStatus,
} from '@mechane/protocol';
import { MechId, renamedWireStruct, SlackBindingId, WatchId } from '@mechane/records';
import { Duration, Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const WATCH_ARGUMENT = { name: 'watch-id', summary: 'the watch ID printed by watch set or watch list' } as const;

const WatchIdentity = renamedWireStruct({
  fields: { mechId: MechId, watchId: WatchId },
  renames: { mechId: 'mech-id', watchId: 'watch-id' },
});

const WatchSetInput = renamedWireStruct({
  fields: {
    mechId: MechId,
    watchId: Schema.optionalKey(WatchId),
    name: WatchName,
    prompt: InboxText,
    intervalSeconds: Schema.NumberFromString.pipe(Schema.decodeTo(WatchIntervalSeconds)),
    maxCheckSeconds: Schema.NumberFromString.pipe(
      Schema.decodeTo(WatchCheckSeconds),
      Schema.withDecodingDefaultKey(Effect.succeed(String(Duration.toSeconds(WATCH_DEFAULT_CHECK_TIME)))),
    ),
    status: Schema.Enum(WatchStatus).pipe(Schema.withDecodingDefaultKey(Effect.succeed(WatchStatus.Active))),
    notificationBindingId: Schema.OptionFromOptionalKey(SlackBindingId),
    cooldownSeconds: Schema.NumberFromString.pipe(
      Schema.decodeTo(WatchIntervalSeconds),
      Schema.withDecodingDefaultKey(Effect.succeed(String(Duration.toSeconds(WATCH_MIN_INTERVAL)))),
    ),
  },
  renames: {
    mechId: 'mech-id',
    watchId: 'watch-id',
    intervalSeconds: 'interval-seconds',
    maxCheckSeconds: 'max-check-seconds',
    notificationBindingId: 'notification-binding-id',
    cooldownSeconds: 'cooldown-seconds',
  },
});

/** Commands for bounded scheduled checks and the evidence they retain. */
export const WATCH_COMMANDS = {
  'watch set': {
    summary: 'save a bounded scheduled check that runs through the mech inbox with its current grants and daily cap',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'setWatch'],
    flags: {
      'watch-id': { kind: FlagKind.Text, summary: 'reuse this watch ID to update or retry; a new ID when absent' },
      'name': { kind: FlagKind.Text, summary: 'a short name for the watch' },
      'prompt': {
        kind: FlagKind.Text,
        summary: 'the focused question to investigate with fresh evidence at each check',
      },
      'interval-seconds': {
        kind: FlagKind.Text,
        summary: 'seconds between checks, from 300 to 2592000; missed intervals coalesce',
      },
      'max-check-seconds': {
        kind: FlagKind.Text,
        summary: 'cancel a running check after 60 to 3600 seconds; 300 when absent',
      },
      'status': { kind: FlagKind.Text, summary: 'active or paused; active when absent' },
      'notification-binding-id': {
        kind: FlagKind.Text,
        summary: 'a Slack binding owned by this mech; absent disables notifications',
      },
      'cooldown-seconds': {
        kind: FlagKind.Text,
        summary: 'minimum seconds between notifications for one finding, from 300 to 2592000; 300 when absent',
      },
    },
    arguments: [MECH_ARGUMENT],
    input: WatchSetInput,
  },
  'watch list': {
    summary: 'list the mech watches, next checks, and latest completed or unknown check outcomes',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listWatches'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId }, renames: { mechId: 'mech-id' } }),
  },
  'watch pause': {
    summary: 'pause future checks independently of interactive agent work and Slack listening or replies',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'updateWatchStatus'],
    flags: {},
    arguments: [MECH_ARGUMENT, WATCH_ARGUMENT],
    input: WatchIdentity,
  },
  'watch resume': {
    summary: 'resume the watch with one fresh check when due, without replaying missed intervals',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'updateWatchStatus'],
    flags: {},
    arguments: [MECH_ARGUMENT, WATCH_ARGUMENT],
    input: WatchIdentity,
  },
  'finding list': {
    summary: 'list a watch findings with stable identities, current evidence, observation windows, and changes',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listFindings'],
    flags: {},
    arguments: [MECH_ARGUMENT, WATCH_ARGUMENT],
    input: WatchIdentity,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
