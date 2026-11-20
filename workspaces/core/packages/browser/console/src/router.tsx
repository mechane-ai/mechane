import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';
import type { ConsoleLocation } from './types.ts';

export function getRouter() {
  return createRouter({ routeTree, basepath: '/console', scrollRestoration: true, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface HistoryState {
    readonly sessionReaderOrigin?: { readonly selection: ConsoleLocation; readonly steps: number };
    readonly sessionEvidenceReturn?: string;
    readonly sessionGalleryOrigin?: ConsoleLocation;
    readonly managedPages?: ReadonlyArray<string | null>;
  }

  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
