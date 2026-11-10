import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';

type PageInput = {
  readonly title: string;
  readonly content: string;
  readonly status?: number;
  readonly headers?: Headers;
};

export function authPage({ title, content, status = HttpStatusCode.Ok, headers = new Headers() }: PageInput): Response {
  const responseHeaders = new Headers(headers);

  responseHeaders.set(HttpHeader.ContentType, MediaType.Html);
  responseHeaders.set(HttpHeader.CacheControl, 'no-store');
  responseHeaders.set(
    HttpHeader.ContentSecurityPolicy,
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );

  if (!responseHeaders.has(HttpHeader.ReferrerPolicy)) {
    responseHeaders.set(HttpHeader.ReferrerPolicy, 'same-origin');
  }

  responseHeaders.set(HttpHeader.XContentTypeOptions, 'nosniff');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml({ value: title })} · Mechane</title><style>html{font:16px/1.5 system-ui,sans-serif;color:#202020;background:#fafafa}body{margin:0;min-height:100vh;display:grid;place-items:center}main{width:min(28rem,calc(100% - 3rem));padding:2rem 0}h1{font-size:1.5rem;font-weight:600;letter-spacing:-.03em}p{color:#5a5a5a}a{color:inherit}label{display:block;margin:1rem 0 .5rem}input,button{font:inherit;border:1px solid #d5d5d5;border-radius:.5rem;padding:.7rem .9rem}input{box-sizing:border-box;width:100%;background:#fff}button{margin-top:1rem;background:#171717;color:#fff;cursor:pointer}button:hover{background:#353535}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #2463eb;outline-offset:3px}dt{color:#707070}dd{margin:0 0 1rem}small{color:#707070}</style></head><body><main><small>mechane</small><h1>${escapeHtml({ value: title })}</h1>${content}</main></body></html>`;

  return new Response(html, { status, headers: responseHeaders });
}

export class AuthPageError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);

    this.name = 'AuthPageError';
    this.status = status;
  }
}
