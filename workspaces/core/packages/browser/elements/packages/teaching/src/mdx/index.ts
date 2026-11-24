/**
 * Explorable essays written in MDX. `Essay` renders a compiled MDX file as an `Article`. `essayComponents` lets the
 * file use Markdown and every teaching part without imports. The application brings its own MDX compiler, such as
 * `@mdx-js/rollup`.
 */
export type { EssayComponents } from './essay-components.ts';
export { essayComponents } from './essay-components.ts';
export type { EssayContent, EssayContentProps, EssayMeta, EssayProps } from './essay.tsx';
export { Essay } from './essay.tsx';
