import { catalogConfiguration } from '@mechane/catalog';

export default catalogConfiguration({
  stories: ['../packages/**/*.stories.tsx'],
  viteConfigurationPath: new URL('vite.config.ts', import.meta.url).pathname,
});
