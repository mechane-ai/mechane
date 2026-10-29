import { HttpHeader } from '@mechane/records';
import type { PageInput } from './types.ts';

/** The referrer policy under which a browser posts a form with an opaque `Origin`, as the Fetch standard says. */
const ORIGIN_WITHHOLDING_POLICY = 'no-referrer';

/** The `Origin` a browser sends when its page's referrer policy withholds the page's origin. */
const OPAQUE_ORIGIN = 'null';

/**
 * The `Origin` a browser sends with a form its page posts to its own origin over HTTP, by the Fetch standard. That is
 * `null` under the referrer policy that withholds it, and the page's origin under any other.
 */
export function formOrigin({ page }: PageInput): string {
  if (page.headers.get(HttpHeader.ReferrerPolicy) === ORIGIN_WITHHOLDING_POLICY) {
    return OPAQUE_ORIGIN;
  }

  return page.url.origin;
}
