import { ErrorFamily, ServerFailure, UnknownFailure } from '@mechane/protocol';
import { Schema } from 'effect';
import { AnswerStep } from './constants.ts';

/**
 * The deployment answered the call with an error: its family, which decides how a caller handles it, and the
 * deployment's message. Its failure is the one its code names, with its own fields, or an `UnknownFailure` for a code
 * this release does not know.
 */
export class OperationFailed extends Schema.TaggedError<OperationFailed>()('OperationFailed', {
  family: Schema.Enum(ErrorFamily),
  message: Schema.String,
  failure: Schema.Union([ServerFailure, UnknownFailure]),
}) {}

/** The request never reached a server that answered, such as when the connection was refused. */
export class OriginUnreachable extends Schema.TaggedError<OriginUnreachable>()('OriginUnreachable', {
  url: Schema.URL,
  reason: Schema.String,
}) {}

/** The server accepted the request but did not answer it within the caller's timeout, such as a hung Worker. */
export class RequestTimedOut extends Schema.TaggedError<RequestTimedOut>()('RequestTimedOut', {
  url: Schema.URL,
  timeout: Schema.DurationFromMillis,
}) {}

/**
 * The server answered with a body that is not JSON, or that the operation's schemas do not decode, such as from another
 * service. Its reason is the parser's or the schema's own text.
 */
export class ResponseUnreadable extends Schema.TaggedError<ResponseUnreadable>()('ResponseUnreadable', {
  url: Schema.URL,
  status: Schema.Int,
  step: Schema.Enum(AnswerStep),
  reason: Schema.String,
}) {}
