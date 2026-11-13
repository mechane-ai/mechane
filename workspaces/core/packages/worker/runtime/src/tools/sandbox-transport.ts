import { HttpHeader, MediaType } from '@mechane/records';
import type { HttpMethod } from '@mechane/records';
import { Redacted } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import { readBoundedJson, rejectRedirect } from './http.ts';

type SandboxJsonRequest = {
  readonly configuration: RuntimeConfiguration;
  readonly url: URL;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post;
  /** Null leaves observations free of commands and credentials. */
  readonly body: string | null;
  readonly maximumBytes: number;
  readonly signal?: AbortSignal | undefined;
};

/** The private sandbox transport has one credential, deadline, redirect policy, and bounded response reader. */
export async function requestSandboxJson(input: SandboxJsonRequest): Promise<unknown> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${Redacted.value(input.configuration.sandbox.bearer)}`,
      [HttpHeader.ContentType]: MediaType.Json,
    },
    body: input.body,
    redirect: 'manual',
    signal: input.signal ?? AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  });

  await rejectRedirect(response);

  return await readBoundedJson(response, input.maximumBytes);
}
