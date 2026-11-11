import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { startHttpService } from './fixtures/http.ts';

const REQUEST_TIMEOUT_MS = 60_000;
const ADMISSION_WAIT_MS = 50_000;
const RETRY_AFTER_SECONDS = '1';
const BODYLESS_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);

const HOP_HEADERS: ReadonlySet<string> = new Set([
  HttpHeader.Host,
  HttpHeader.ProxyAuthorization,
  'connection',
  'transfer-encoding',
]);

type IngressInput = { readonly target: URL };
type Admission = ReturnType<typeof Promise.withResolvers<void>>;

export type SandboxIngress = {
  readonly origin: URL;
  readonly hold: () => Promise<void>;
  readonly resume: () => void;
  readonly isHeld: () => boolean;
  readonly close: () => Promise<void>;
};

/** The local owner fences new environment requests while native retirement and source replacement finish. */
export async function startSandboxIngress({ target }: IngressInput): Promise<SandboxIngress> {
  const state: { admission: Admission | undefined; isClosed: boolean } = { admission: undefined, isClosed: false };
  const pending = new Set<Promise<void>>();

  function unavailable(): Response {
    return Response.json(
      { error: 'The local environment is applying source changes' },
      { status: HttpStatusCode.Unavailable, headers: { [HttpHeader.RetryAfter]: RETRY_AFTER_SECONDS } },
    );
  }

  async function reserve(): Promise<Admission | undefined> {
    const expired = Promise.withResolvers<void>();
    const timer = setTimeout(expired.resolve, ADMISSION_WAIT_MS);
    const deadlineMs = Date.now() + ADMISSION_WAIT_MS;

    try {
      while (state.admission !== undefined && !state.isClosed && Date.now() < deadlineMs) {
        await Promise.race([state.admission.promise, expired.promise]);
      }

      if (state.admission !== undefined || state.isClosed) {
        return undefined;
      }

      const settled = Promise.withResolvers<void>();

      pending.add(settled.promise);

      return settled;
    } finally {
      clearTimeout(timer);
    }
  }

  const service = await startHttpService(async (request) => {
    const settled = await reserve();

    if (settled === undefined) {
      return unavailable();
    }

    try {
      const received = new URL(request.url);
      const url = new URL(received.pathname + received.search, target);
      const headers = new Headers(request.headers);

      for (const name of HOP_HEADERS) {
        headers.delete(name);
      }

      const options: RequestInit = {
        method: request.method,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      };

      if (!BODYLESS_METHODS.has(request.method)) {
        options.body = new Uint8Array(await request.arrayBuffer());
      }

      return await fetch(url, options);
    } catch {
      return unavailable();
    } finally {
      pending.delete(settled.promise);
      settled.resolve();
    }
  });

  return {
    origin: service.origin,
    hold: async () => {
      state.admission ??= Promise.withResolvers<void>();

      await Promise.all(pending);
    },
    resume: () => {
      const held = state.admission;

      state.admission = undefined;

      held?.resolve();
    },
    isHeld: () => state.admission !== undefined,
    close: async () => {
      state.isClosed = true;

      state.admission?.resolve();

      await service.close();
    },
  };
}
