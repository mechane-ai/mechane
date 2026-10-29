import type { ClientFailure } from '@mechane/client';
import type { Redacted } from 'effect';
import type { DeployStep } from '../constants.ts';
import type { OpenRouterKey } from './schemas.ts';

/** OpenRouter's report of the production key: its credit limit, its usage and the credit it has left, in dollars. */
export type OpenRouterCredit = OpenRouterKey['key'];

export type DescribeFailureInput = { readonly failure: ClientFailure };

/** A request for production, Cloudflare's API or OpenRouter's, how its answer's body is read, and the step it is. */
export type FetchAnswerInput<A> = {
  readonly url: URL;
  readonly init: RequestInit;
  readonly step: DeployStep;
  readonly read: (response: Response) => Promise<A>;
};

/** An answer's status, its headers, and its body as the request read it. */
export type Answer<A> = {
  readonly status: number;
  readonly isOk: boolean;
  readonly headers: Headers;
  readonly body: A;
};

/** A request to an API that takes a bearer token, the schema of its JSON answer, and the step it is. */
export type ReadJsonInput<S> = {
  readonly url: URL;
  readonly init: RequestInit;
  readonly token: Redacted.Redacted;
  readonly schema: S;
  readonly step: DeployStep;
};
