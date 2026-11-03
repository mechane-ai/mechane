import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';
import type { PageCursors } from './types.ts';

export function getRouter() {
  return createRouter({ routeTree, basepath: '/console', scrollRestoration: true, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface HistoryState {
    readonly consolePages?: Partial<PageCursors>;
    readonly consoleReturn?: { readonly row: string; readonly scrollTop: number };
  }

  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
