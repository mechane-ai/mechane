import { HttpMethod } from '@mechane/records';
import { MechNotFound, ServiceUnavailable } from '../errors/errors.ts';
import { Access } from '../operation/constants.ts';
import { NoFields } from '../operation/schemas.ts';
import { MechPath } from './schemas.ts';

export const MEMBER_MECH_READ = {
  method: HttpMethod.Get,
  access: Access.Member,
  params: MechPath,
  body: NoFields,
  errors: [MechNotFound, ServiceUnavailable],
} as const;
