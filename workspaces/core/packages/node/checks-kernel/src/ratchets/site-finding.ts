import { siteKey } from '../site-key.ts';
import type { Finding, Site } from '../types.ts';

type SiteInput = { readonly site: Site };

/** An enforced rule's finding at one site, located by its file and line. */
export function siteFinding({ site }: SiteInput): Finding {
  return { check: site.rule, location: siteKey({ file: site.file, line: site.line }), message: site.message };
}
