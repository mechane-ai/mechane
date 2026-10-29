import type { TextInput } from './types.ts';

/** Text made safe to place in an element's content or in a quoted attribute value. */
export function escapeHtml({ text }: TextInput): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
