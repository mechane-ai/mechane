import type { Schema } from 'effect';
import type { FailureCodec } from '../errors/types.ts';
import type { Access } from './constants.ts';
import type { ResponseKind } from './media-response.ts';
import type { OperationMethod } from './schemas.ts';

/** A schema the router and the client run without services, such as a struct or a tagged error. */
export type ServiceFreeCodec = Schema.Codec<unknown, unknown>;

/** The schema of a request part whose encoded fields are text, such as path or query parameters. */
export type TextFieldsCodec = Schema.Codec<object, Readonly<Record<string, string>>>;

/** The schema of a request body, which mutations carry as JSON and a `GET` operation leaves empty. */
export type BodyCodec = Schema.Codec<object, unknown>;

/**
 * One HTTP operation, declared once; the server's router and the client both derive from it. `:name` segments of `path`
 * are path parameters that `params` decodes.
 */
type OperationDeclaration = {
  readonly method: OperationMethod;
  readonly path: `/${string}`;
  readonly access: Access;
  readonly params: TextFieldsCodec;
  readonly query: TextFieldsCodec;
  readonly body: BodyCodec;
  readonly output: ServiceFreeCodec;
  readonly errors: ReadonlyArray<FailureCodec>;
};

type MediaResponseDeclaration = {
  readonly kind: typeof ResponseKind.Media;
  readonly mediaType: Schema.Codec<string, string>;
};

type MediaOperationDeclaration = OperationDeclaration & { readonly response: MediaResponseDeclaration };

/** JSON is the ordinary success body; media declarations retain their authenticated stream. */
export type Operation = OperationDeclaration | MediaOperationDeclaration;

/** The one object a caller passes: path parameters, query parameters and body fields together. */
export type OperationInput<O extends Operation> = O['params']['Type'] & O['query']['Type'] & O['body']['Type'];

/** What an operation answers when it succeeds. */
export type OperationOutput<O extends Operation> = O['output']['Type'];
