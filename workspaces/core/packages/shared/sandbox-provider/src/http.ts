import type { HttpMethod } from '@mechane/records';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { SandboxProviderError } from './errors.ts';
import type { PluggableSandboxProvider } from './schemas.ts';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type SandboxHttpMethod = typeof HttpMethod.Get | typeof HttpMethod.Post | typeof HttpMethod.Delete;

type SandboxHttpInput = {
  readonly url: string;
  readonly method: SandboxHttpMethod;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly body?: unknown;
  readonly timeoutMs?: number | undefined;
  readonly transport?: typeof fetch | undefined;
};

type SandboxHttpResponse = { readonly status: number; readonly isOk: boolean; readonly body: unknown };

type BearerSandboxClientInput = {
  readonly baseUrl: string;
  readonly bearerToken: string;
  readonly transport?: typeof fetch | undefined;
};

function isRetryableStatus(status: number): boolean {
  return status === HttpStatusCode.TooManyRequests || status >= HttpStatusCode.InternalServerError;
}

/** Sends a bounded JSON HTTP request to an external sandbox provider control plane. */
async function requestSandboxJson({
  url,
  method,
  headers,
  body,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  transport = fetch,
}: SandboxHttpInput): Promise<SandboxHttpResponse> {
  const requestHeaders: Record<string, string> = { ...headers };

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (body !== undefined) {
    requestHeaders[HttpHeader.ContentType] = MediaType.Json;
    requestInit.body = JSON.stringify(body);
  }

  const response = await transport(url, requestInit);
  const text = await response.text();

  const parsed: unknown = (() => {
    if (text.length === 0) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })();

  return { status: response.status, isOk: response.ok, body: parsed };
}

/** Creates a bearer-authenticated JSON client bound to a sandbox provider origin. */
export function createBearerSandboxClient({ baseUrl, bearerToken, transport }: BearerSandboxClientInput) {
  const origin = baseUrl.replace(/\/+$/u, '');
  const headers = { [HttpHeader.Authorization]: `Bearer ${bearerToken}` };

  return async (method: SandboxHttpMethod, path: string, body?: unknown): Promise<SandboxHttpResponse> =>
    await requestSandboxJson({ url: `${origin}${path}`, method, headers, body, transport });
}

export function requireSandboxOk(
  provider: PluggableSandboxProvider,
  response: SandboxHttpResponse,
  operation: string,
): unknown {
  if (!response.isOk) {
    throw new SandboxProviderError({
      provider,
      status: response.status,
      isRetryable: isRetryableStatus(response.status),
      reason: `Sandbox provider ${provider} failed ${operation} with HTTP ${response.status}`,
    });
  }

  return response.body;
}
