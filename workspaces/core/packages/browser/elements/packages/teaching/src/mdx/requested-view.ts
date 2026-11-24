import { useSyncExternalStore } from 'react';
import type { ArticleView } from '../article/index.ts';

const viewNames: ReadonlyMap<string, ArticleView> = new Map([
  ['article', 'article'],
  ['present', 'present'],
  ['static', 'static'],
  ['sheet', 'sheet'],
]);

function viewInAddress(): ArticleView {
  return viewNames.get(new URLSearchParams(globalThis.location.search).get('view') ?? '') ?? 'article';
}

function serverView(): ArticleView {
  return 'article';
}

function watchAddress(listener: () => void): () => void {
  globalThis.addEventListener('popstate', listener);

  return () => globalThis.removeEventListener('popstate', listener);
}

/**
 * The view the address asks for with `?view=present`, `static` or `sheet`, and `article` when it asks for none. The
 * server and the first browser render show `article`, so the page hydrates cleanly before it switches.
 */
export function useRequestedView(): ArticleView {
  return useSyncExternalStore(watchAddress, viewInAddress, serverView);
}
