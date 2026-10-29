import { Schema } from 'effect';
import { UnknownFields } from '../schemas.ts';
import { ErrorFamily } from './constants.ts';

/**
 * One error a response reports: its family and its code, which is the failure's tag, the deployment's message, and the
 * failure's own fields under snake_case keys. A client reads a code it does not know by `family`.
 */
export const ErrorDetail = Schema.StructWithRest(
  Schema.Struct({ family: Schema.Enum(ErrorFamily), code: Schema.String, message: Schema.String }),
  [UnknownFields],
);

export type ErrorDetail = typeof ErrorDetail.Type;

/** The body of every error response. */
export const ErrorBody = Schema.Struct({ error: ErrorDetail });

export type ErrorBody = typeof ErrorBody.Type;
