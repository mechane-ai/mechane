import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import type { BrowserForm, BrowserPage, BrowserRequest, SmokeBrowser } from './types.ts';

const REQUEST_TIMEOUT_MS = 15_000;
const REDIRECT_MAX_HOPS = 12;
const HIDDEN_INPUT = /<input\b[^>]*\btype="hidden"[^>]*>/gu;
const ATTRIBUTE = /\b([\w-]+)="([^"]*)"/gu;

function decodedAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

export function formFields(page: BrowserPage): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};

  for (const input of page.text.matchAll(HIDDEN_INPUT)) {
    const attributes = inputAttributes(input[0]);
    const name = attributes.get('name');
    const value = attributes.get('value');

    if (name !== undefined && value !== undefined) {
      fields[name] = decodedAttribute(value);
    }
  }

  return fields;
}

function inputAttributes(input: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();

  for (const match of input.matchAll(ATTRIBUTE)) {
    const attribute = match[1];
    const value = match[2];

    if (attribute !== undefined && value !== undefined) {
      attributes.set(attribute, value);
    }
  }

  return attributes;
}

function responseCookies(jar: ReadonlyMap<string, string>, headers: Headers): ReadonlyMap<string, string> {
  const updated = new Map(jar);

  for (const cookie of headers.getSetCookie()) {
    const separator = cookie.indexOf('=');
    const name = cookie.slice(0, separator);
    const value = cookie.slice(separator + 1).split(';', 1)[0] ?? '';

    if (value.length === 0 || /(?:^|;)\s*max-age=0(?:;|$)/iu.test(cookie)) {
      updated.delete(name);
    } else {
      updated.set(name, value);
    }
  }

  return updated;
}

export function createBrowser(origins: ReadonlyArray<URL>): SmokeBrowser {
  const admitted = new Set(origins.map((origin) => origin.origin));
  const cookies = new Map<string, ReadonlyMap<string, string>>();

  async function request(input: BrowserRequest): Promise<BrowserPage> {
    let target = input.url;
    let method = input.method ?? HttpMethod.Get;
    let body = input.body;

    for (let redirects = 0; redirects <= REDIRECT_MAX_HOPS; redirects += 1) {
      if (!admitted.has(target.origin)) {
        throw new Error('The browser was redirected outside the local services');
      }

      const headers = new Headers(input.headers);

      if (target.origin !== input.url.origin) {
        headers.delete(HttpHeader.Authorization);
        headers.delete(HttpHeader.Origin);
      }

      const jar = cookies.get(target.origin) ?? new Map<string, string>();

      if (jar.size > 0) {
        headers.set(HttpHeader.Cookie, [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
      }

      const response = await fetch(target, {
        method,
        headers,
        body: body ?? null,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      cookies.set(target.origin, responseCookies(jar, response.headers));

      const text = await response.text();
      const location = response.headers.get(HttpHeader.Location);

      const isRedirect =
        response.status >= HttpStatusCode.MultipleChoices && response.status < HttpStatusCode.BadRequest;

      if (input.shouldFollowRedirects === false || location === null || !isRedirect) {
        return { url: target, status: response.status, headers: response.headers, text };
      }

      target = new URL(location, target);
      method = HttpMethod.Get;
      body = undefined;
    }

    throw new Error('The local browser exceeded its redirect limit');
  }

  async function submit({ page, fields = {} }: BrowserForm): Promise<BrowserPage> {
    return await request({
      url: page.url,
      method: HttpMethod.Post,
      headers: { [HttpHeader.Origin]: page.url.origin },
      body: new URLSearchParams({ ...formFields(page), ...fields }),
    });
  }

  return { request, submit };
}
