import { Schema } from 'effect';
import { RecordId } from './schemas.ts';

/** The ID of a mech within its workspace. */
export const MechId = RecordId.pipe(Schema.brand('MechId'));
export type MechId = typeof MechId.Type;

/** The ID of the workspace that owns its resources and grants. */
export const WorkspaceId = RecordId.pipe(Schema.brand('WorkspaceId'));
export type WorkspaceId = typeof WorkspaceId.Type;

/** The ID of the authenticated actor recorded on an operation. */
export const PrincipalId = RecordId.pipe(Schema.brand('PrincipalId'));
export type PrincipalId = typeof PrincipalId.Type;

/** The stable ID of one durable inbox admission. */
export const InboxItemId = RecordId.pipe(Schema.brand('InboxItemId'));
export type InboxItemId = typeof InboxItemId.Type;

/** The ID of a configured Slack audience owned by one mech. */
export const SlackBindingId = RecordId.pipe(Schema.brand('SlackBindingId'));
export type SlackBindingId = typeof SlackBindingId.Type;

/** The stable ID of one durable Slack delivery intent. */
export const SlackDeliveryId = RecordId.pipe(Schema.brand('SlackDeliveryId'));
export type SlackDeliveryId = typeof SlackDeliveryId.Type;
