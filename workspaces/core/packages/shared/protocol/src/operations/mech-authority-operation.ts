import { MechNotFound, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../errors/errors.ts';
import { Access } from '../operation/constants.ts';
import { NoFields } from '../operation/schemas.ts';
import { MechPath } from './schemas.ts';

/** Mech authority operations require current workspace ownership and recheck write authority in their handlers. */
export const MECH_AUTHORITY_OPERATION = {
  access: Access.Owner,
  params: MechPath,
  query: NoFields,
  errors: [MechNotFound, ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const;
