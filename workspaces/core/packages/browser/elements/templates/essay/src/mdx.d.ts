declare module '*.mdx' {
  import type { EssayContent, EssayMeta } from '@mechane-ai/elements/mdx';

  const Content: EssayContent;
  export const meta: EssayMeta;
  export default Content;
}
