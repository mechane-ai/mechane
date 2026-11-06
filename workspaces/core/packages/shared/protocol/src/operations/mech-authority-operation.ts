import { MechNotFound, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../errors/errors.ts';
import { Access } from '../operation/constants.ts';
import { NoFields } from '../operation/schemas.ts';
import { MechPath } from './schemas.ts';

/** Mech authority operations authenticate membership, then require current ownership in their handlers. */
export const MECH_AUTHORITY_OPERATION = {
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  errors: [MechNotFound, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const;
