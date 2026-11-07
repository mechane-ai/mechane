import { ExternalApprovalId, ExternalRequestId, RecordText, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { IntegrationSecretReference, RemoteMcpUrl } from '../connections/schemas.ts';

const MAXIMUM_REQUEST_URL_LENGTH = 2048;
const MAXIMUM_REQUEST_ERROR_LENGTH = 500;
const MAXIMUM_REQUEST_STATUS_LENGTH = 128;

/** The owner chooses one request collection; its credential stays outside the guest environment. */
export const RequestService = wireStruct({
  fields: { url: RemoteMcpUrl, secretReference: IntegrationSecretReference },
});

export type RequestService = typeof RequestService.Type;

/** Existing grants remain readable independently of future request limits. */
export const RequestServiceRecord = wireStruct({ fields: { url: RemoteMcpUrl, secretReference: RecordText } });

/** The service's request collections share one status protocol and keep their own completion rules. */
export const ExternalRequestKind = { Access: 'access', Vend: 'vend', Action: 'action' } as const;

export type ExternalRequestKind = (typeof ExternalRequestKind)[keyof typeof ExternalRequestKind];

/** Ready permits the next domain step; it does not prove the agent's requested operation is complete. */
export const ExternalRequestState = {
  Pending: 'pending',
  Ready: 'ready',
  Denied: 'denied',
  Expired: 'expired',
  Cancelled: 'cancelled',
  Revoked: 'revoked',
  Failed: 'failed',
} as const;

/** The service distinguishes existing authority, automatic grants, and decisions that require an approver. */
export const ExternalRequestAuthorization = {
  Standing: 'standing',
  Automatic: 'automatic',
  Approval: 'approval',
} as const;

export type ExternalRequestAuthorization =
  (typeof ExternalRequestAuthorization)[keyof typeof ExternalRequestAuthorization];

/** A request service's common response contains status and navigation, never a credential. */
export const ExternalRequestStatus = Schema.Struct({
  id: ExternalRequestId,
  kind: Schema.Enum(ExternalRequestKind),
  status: Schema.Enum(ExternalRequestState),
  /** Absent when the service provides only the common request status. */
  domainStatus: Schema.optionalKey(RecordText.check(Schema.isMaxLength(MAXIMUM_REQUEST_STATUS_LENGTH))),
  /** Absent when the service does not classify this request's authorization path. */
  authorization: Schema.optionalKey(Schema.Enum(ExternalRequestAuthorization)),
  /** None means no approval details are available; the request's status still determines readiness. */
  approval: Schema.OptionFromNullOr(
    Schema.Struct({
      id: ExternalApprovalId,
      url: Schema.String.check(Schema.isMaxLength(MAXIMUM_REQUEST_URL_LENGTH)),
      status: RecordText,
    }),
  ),
  /** None means the service reported no failure explanation. */
  error: Schema.OptionFromNullOr(RecordText.check(Schema.isMaxLength(MAXIMUM_REQUEST_ERROR_LENGTH))),
});

export type ExternalRequestStatus = typeof ExternalRequestStatus.Type;
