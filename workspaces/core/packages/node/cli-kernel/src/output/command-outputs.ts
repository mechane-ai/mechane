import type { CommandName } from '@mechane/commands';
import { EvalComparison, EvalInspection } from '@mechane/eval';
import {
  CredentialDeletion,
  CredentialList,
  CredentialMetadata,
  ExecutionAccessState,
  ManagedAgentPolicy,
  Readiness,
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
  'agent-policy show': ManagedAgentPolicy,
  'agent-policy set': ManagedAgentPolicy,
  'execution-access show': ExecutionAccessState,
  'execution-access revoke': ExecutionAccessState,
  'execution-access set': ExecutionAccessState,
  'credential put': CredentialMetadata,
  'credential list': CredentialList,
  'credential delete': CredentialDeletion,
  'readiness': Readiness,
  ...ACCESS_OUTPUTS,
  ...WORKSPACE_OUTPUTS,
  'eval run': EvalInspection,
  'eval inspect': EvalInspection,
  'eval compare': EvalComparison,
  'update': UpdateResult,
} as const satisfies Readonly<Record<CommandName, Schema.Top>>;
