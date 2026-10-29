import { HttpHeader, MediaType } from '@mechane/records';
import type { HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { NO_STORE } from '../constants.ts';
import type { PageHeader } from '../types.ts';

type RenderPageInput = {
  readonly status: HttpStatusCode;
  readonly title: string;
  readonly body: string;
  /** Headers beside the pages' own, such as `set-cookie`. */
  readonly headers: ReadonlyArray<PageHeader>;
};

/** What a page may load and where its form may post: nothing but its own inline style, and its own origin. */
const PAGE_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/**
 * The headers of every page: it is never cached or framed, loads nothing, and posts its form only to its own origin.
 * Its referrer goes only to its own origin, keeping the device URL and GitHub's code and state from other sites. Under
 * `no-referrer`, a browser would send the approval form with `Origin: null`, which the exact origin check refuses.
 */
const PAGE_HEADERS: ReadonlyArray<PageHeader> = [
  [HttpHeader.ContentType, MediaType.Html],
  [HttpHeader.CacheControl, NO_STORE],
  [HttpHeader.ContentSecurityPolicy, PAGE_POLICY],
  [HttpHeader.ReferrerPolicy, 'same-origin'],
  [HttpHeader.XContentTypeOptions, 'nosniff'],
];

/** The pages' one style sheet, inline because the policy loads nothing. */
const PAGE_STYLE = [
  'body { font: 16px/1.5 system-ui, sans-serif; margin: 0; background: #f6f6f4; color: #1d1d1b; }',
  'main { max-width: 32rem; margin: 4rem auto; padding: 0 1rem; }',
  'dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; }',
  'dt { color: #66665f; } dd { margin: 0; } code { font-size: 1.25rem; letter-spacing: 0.1em; }',
  'pre { overflow-x: auto; padding: 1rem; background: #fff; border-radius: 0.375rem; }',
  'pre code { font-size: 0.875rem; letter-spacing: normal; }',
  'input { font: inherit; font-size: 1.25rem; letter-spacing: 0.1em; padding: 0.375rem; width: 10rem; }',
  'button { font: inherit; padding: 0.5rem 1.5rem; border: 0; border-radius: 0.375rem; }',
  'button { background: #1d1d1b; color: #fff; cursor: pointer; }',
].join('\n');

/**
 * A page with the deployment's layout and headers, which no header of its own replaces; `body` is markup whose every
 * interpolated value is escaped.
 */
export function renderPage({ status, title, body, headers }: RenderPageInput): Response {
  const heading = escapeHtml({ text: title });

  const page = [
    '<!doctype html>',
    '<html lang="en">',
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${heading} · Mechane</title><style>${PAGE_STYLE}</style></head>`,
    `<body><main><h1>${heading}</h1>${body}</main></body>`,
    '</html>',
  ].join('\n');

  return new Response(page, { status, headers: new Headers([...PAGE_HEADERS, ...headers]) });
}
