/** A file and a line in it, from 1. */
type SiteKeyInput = { readonly file: string; readonly line: number };

/** Where a finding sits in a file, `file:line`, which editors and the ratchets' sites both read. */
export function siteKey({ file, line }: SiteKeyInput): string {
  return `${file}:${line}`;
}
