import type { CommandName } from '@mechane/commands';
import { Report } from '@mechane/eval';
import {
  ConnectionDeletion,
  ConnectionList,
  CredentialDeletion,
  CredentialList,
  CredentialMetadata,
  ExecutionAccessState,
  ListedEvent,
  Mech,
  MechList,
  MechRevisionPage,
  NotificationReceipt,
  Readiness,
  RemoteConnection,
  SandboxReport,
  ToolGrant,
  ToolGrantList,
  Trace,
  TurnCancel,
} from '@mechane/protocol';
import type { Schema } from 'effect';
import { UpdateResult } from '../schemas.ts';
import { ACCESS_OUTPUTS } from './access-outputs.ts';
import { WORKSPACE_OUTPUTS } from './workspace-outputs.ts';

/**
 * The schema of each command's result, which the output module encodes for `json` and `jsonl`; a streaming command's
 * result is one of its records. A command without one fails to compile.
 */
export const COMMAND_OUTPUTS = {
  'execution-access show': ExecutionAccessState,
  'execution-access set': ExecutionAccessState,
  'credential put': CredentialMetadata,
  'credential list': CredentialList,
  'credential delete': CredentialDeletion,
  'connection create': RemoteConnection,
  'connection update': RemoteConnection,
  'connection list': ConnectionList,
  'connection delete': ConnectionDeletion,
  'grant set': ToolGrant,
  'grant list': ToolGrantList,
  'grant revoke': ToolGrant,
  'sandbox show': SandboxReport,
  'sandbox upgrade': SandboxReport,
  'sandbox delete': SandboxReport,
  'sandbox cancel': SandboxReport,
  'readiness': Readiness,
  ...ACCESS_OUTPUTS,
  ...WORKSPACE_OUTPUTS,
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
  'notification send': NotificationReceipt,
  'event list': ListedEvent,
  'turn show': Trace,
  'turn cancel': TurnCancel,
  'eval run': Report,
  'update': UpdateResult,
} as const satisfies Readonly<Record<CommandName, Schema.Top>>;
