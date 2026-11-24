import type { ReactNode } from 'react';
import { Article } from '../article/index.ts';
import type { ArticleProps, ArticleView } from '../article/index.ts';
import type { LessonParams } from '../lesson/index.ts';
import { essayComponents } from './essay-components.ts';
import type { EssayComponents } from './essay-components.ts';
import { useRequestedView } from './requested-view.ts';

/** The metadata an essay file may export as `export const meta = { title: '…' }`, to spread onto `Essay`. */
export type EssayMeta = {
  readonly title: string;
  readonly authors?: ReadonlyArray<string> | undefined;
  /** The publication date as an ISO date, such as `2026-11-23`. */
  readonly date?: string | undefined;
  readonly summary?: string | undefined;
};

/** The props a compiled MDX component takes: the components its elements and tags resolve to. */
export type EssayContentProps = { readonly components?: EssayComponents };

/** A compiled MDX file: the default export of `essay.mdx` once the application's MDX plugin has compiled it. */
export type EssayContent = (props: EssayContentProps) => ReactNode;

export type EssayProps<Params extends LessonParams, Derived extends string, Beat extends string> = Omit<
  ArticleProps<Params, Derived, Beat>,
  'children' | 'view'
> & {
  /** The compiled MDX file: `import Content from './essay.mdx'`. */
  readonly content: EssayContent;
  /** Components the essay file may use besides `essayComponents`, or instead of them under the same name. */
  readonly components?: EssayComponents | undefined;
  /** How the essay is arranged. Without it, the `view` address parameter decides: `?view=present|static|sheet`. */
  readonly view?: ArticleView | undefined;
};

/**
 * An explorable essay written as one MDX file. It renders the compiled file inside an `Article` with `essayComponents`,
 * so the file uses `Beat`, `Param`, `Figure`, `Scene` and the rest without imports. The file's elements are read once
 * so the article sees its beats, and a compiled file that reads a context hook sits inside this component's render.
 */
export function Essay<Params extends LessonParams, Derived extends string, Beat extends string>({
  content,
  components,
  view,
  ...article
}: EssayProps<Params, Derived, Beat>): ReactNode {
  const requested = useRequestedView();

  return (
    <Article {...article} view={view ?? requested}>
      {content({ components: { ...essayComponents, ...components } })}
    </Article>
  );
}
