type InstalledResource =
  | { readonly collection: 'processes' | 'completions' | 'browser'; readonly id: string; readonly part?: never }
  | { readonly collection: 'evidence'; readonly id: string; readonly part?: 'content' };

export function installedComputerResourcePath({ collection, id, part }: InstalledResource): `/${string}` {
  const segments: Array<string> = [collection, encodeURIComponent(id)];

  if (part !== undefined) {
    segments.push(part);
  }

  return `/${segments.join('/')}`;
}
