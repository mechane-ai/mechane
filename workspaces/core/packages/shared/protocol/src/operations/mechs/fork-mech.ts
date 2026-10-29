import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { MechBusy, MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { Mech, MechName } from './schemas.ts';

/** A fork: a mech to copy whole under a new name; the copy keeps its model, instructions and daily cap. */
const ForkMechBody = Schema.Struct({ name: MechName });

type ForkMechBody = typeof ForkMechBody.Type;

/**
 * Forks an idle mech into a new mech of its workspace, under an id the deployment makes, and neither one's work reaches
 * the other after. The fork holds the mech's life so far, its conversation, memory, inbox, turns, events, threads and
 * drones, but not its sandbox's files. A mech that is not idle is busy, and a retry of a fork cut off before it
 * answered finishes that fork's mech.
 */
export const forkMech = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/fork',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: ForkMechBody,
  output: Mech,
  errors: [MechNotFound, MechBusy, ObjectUnavailable],
} as const satisfies Operation;
