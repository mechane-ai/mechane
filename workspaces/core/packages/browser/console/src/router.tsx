import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';

export function getRouter() {
  return createRouter({ routeTree, basepath: '/console', scrollRestoration: true, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
