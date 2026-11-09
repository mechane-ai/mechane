import { HttpMethod, MechId, wireStruct, WorkspaceId } from '@mechane/records';
import { MechNotFound, NotificationConflict, ServiceUnavailable } from '../../errors/errors.ts';
import { MechArchived } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { NotificationBody, NotificationId, NotificationReceipt } from './schemas.ts';

export const sendNotification = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/notifications/:notification_id',
  access: Access.Member,
  params: wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId, notificationId: NotificationId } }),
  query: NoFields,
  body: NotificationBody,
  output: NotificationReceipt,
  errors: [MechNotFound, MechArchived, NotificationConflict, ServiceUnavailable],
} as const satisfies Operation;
