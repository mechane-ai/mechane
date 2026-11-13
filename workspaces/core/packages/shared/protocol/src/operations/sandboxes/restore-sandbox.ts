import { HttpMethod } from '@mechane/records';
import { SandboxRestoreRequest, SandboxRestoreResult } from '@mechane/sandbox-wire';
import { MechNotFound } from '../../errors/errors.ts';
import { SandboxDisabled } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';

/** Explicitly restores the last committed files after positively confirmed physical machine loss. */
export const restoreSandbox = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/sandbox/restore',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: SandboxRestoreRequest,
  output: SandboxRestoreResult,
  errors: [MechNotFound, SandboxDisabled],
} as const satisfies Operation;
