import type { CommandName } from '@mechane/commands';
import { Report } from '@mechane/eval';
import {
  Allowance,
  ConnectionDeletion,
  ConnectionList,
  DroneCancel,
  DroneList,
  DroneTrace,
  FindingList,
  InboxItem,
  KeyList,
  KeyMetadata,
  ListedEvent,
  Mech,
  MechList,
  MechRevisionPage,
  MemoryList,
  Principal,
  Readiness,
  RemoteConnection,
  SandboxReport,
  SlackBindingResult,
  SlackBindings,
  SlackDeliveries,
  SourceReport,
  ThreadList,
  ToolGrant,
  ToolGrantList,
  Trace,
  TurnCancel,
  Watch,
  WatchList,
  Workspace,
  WorkspaceList,
} from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CredentialSource } from '../constants.ts';
import { UpdateResult } from '../schemas.ts';

/** What `mechane auth login` reports: the account, its new login key, and the file that saved it, never the token. */
const LoginResult = wireStruct({
  fields: { origin: Schema.String, principal: Principal, key: KeyMetadata, credentialsFile: Schema.String },
});

type LoginResult = typeof LoginResult.Type;

/** What `mechane auth logout` reports: the login key it revoked, and the saved login it removed. */
const LogoutResult = wireStruct({
  fields: { origin: Schema.String, key: KeyMetadata, credentialsFile: Schema.String },
});

type LogoutResult = typeof LogoutResult.Type;

/** What `mechane auth status` reports: the account, the key the CLI sent and where it came from, and the workspaces. */
const StatusResult = wireStruct({
  fields: {
    origin: Schema.String,
    credentialSource: Schema.Enum(CredentialSource),
    principal: Principal,
    key: KeyMetadata,
    workspaces: Schema.Array(Workspace),
  },
});

type StatusResult = typeof StatusResult.Type;

/** What `mechane key create` reports: the new key and the file that holds its token, never the token. */
const KeyCreateResult = wireStruct({ fields: { principal: Principal, key: KeyMetadata, keyFile: Schema.String } });

type KeyCreateResult = typeof KeyCreateResult.Type;

/**
 * The schema of each command's result, which the output module encodes for `json` and `jsonl`; a streaming command's
 * result is one of its records. A command without one fails to compile.
 */
export const COMMAND_OUTPUTS = {
  'source grant': SourceReport,
  'source revoke': SourceReport,
  'source checkout': SourceReport,
  'source publish': SourceReport,
  'source show': SourceReport,
  'watch set': Watch,
  'watch list': WatchList,
  'watch pause': Watch,
  'watch resume': Watch,
  'finding list': FindingList,
  'connection create': RemoteConnection,
  'connection update': RemoteConnection,
  'connection list': ConnectionList,
  'connection delete': ConnectionDeletion,
  'grant set': ToolGrant,
  'grant list': ToolGrantList,
  'grant revoke': ToolGrant,
  'sandbox show': SandboxReport,
  'sandbox upgrade': SandboxReport,
  'sandbox import': SandboxReport,
  'sandbox delete': SandboxReport,
  'sandbox cancel': SandboxReport,
  'sandbox export': Schema.Struct({ sandbox: SandboxReport, file: Schema.String }),
  'readiness': Readiness,
  'auth login': LoginResult,
  'auth status': StatusResult,
  'auth logout': LogoutResult,
  'key create': KeyCreateResult,
  'key list': KeyList,
  'key revoke': KeyMetadata,
  'workspace list': WorkspaceList,
  'allowance show': Allowance,
  'mech create': Mech,
  'mech list': MechList,
  'mech fork': Mech,
  'mech clone': Mech,
  'mech show': Mech,
  'mech update': Mech,
  'mech rename': Mech,
  'mech pause': Mech,
  'mech resume': Mech,
  'mech archive': Mech,
  'mech revisions': MechRevisionPage,
  'inbox send': InboxItem,
  'slack bind': SlackBindingResult,
  'slack bindings': SlackBindings,
  'slack deliveries': SlackDeliveries,
  'event list': ListedEvent,
  'turn show': Trace,
  'turn cancel': TurnCancel,
  'memory list': MemoryList,
  'thread list': ThreadList,
  'drone list': DroneList,
  'drone show': DroneTrace,
  'drone cancel': DroneCancel,
  'eval run': Report,
  'update': UpdateResult,
} as const satisfies Readonly<Record<CommandName, Schema.Top>>;
