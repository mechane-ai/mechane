import type {
  ExternalRequestKind,
  ExternalRequestStatus,
  ExternalRequestUnavailable,
  RequestService,
} from '@mechane/protocol';
import type { ExternalRequestId, HttpMethod } from '@mechane/records';
import type { Option, Redacted, Result } from 'effect';

/** A validated request status or a failure that is safe to expose to the waiting agent. */
export type RequestServiceOutcome = Result.Result<ExternalRequestStatus, ExternalRequestUnavailable>;

export type ServiceRequestInput = {
  readonly service: RequestService;
  readonly token: Redacted.Redacted;
  readonly kind: ExternalRequestKind;
  readonly requestId: ExternalRequestId;
  readonly method: HttpMethod;
  /** None reads a request; some creates it under the supplied stable identity. */
  readonly body: Option.Option<string>;
};
