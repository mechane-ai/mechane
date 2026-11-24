# MDX

Import from `@mechane-ai/elements/mdx`. One `.mdx` file is the essay: Markdown prose with the teaching parts written as
tags. `Essay` renders the compiled file as an `Article`, and `essayComponents` lets the file use every part without
imports: `Beat`, `Figure`, `Param`, `Value`, `Predict`, `Challenge`, `Scrolly`, `Term`, `TeX`, `Scene` and the scene
parts. Markdown headings, lists, code and tables map to Elements typography. The essay starter is set up this way.

## Set up

The application brings its own MDX compiler. With Vite and `@mdx-js/rollup`, MDX runs before the React plugin:

```ts
import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [{ enforce: 'pre', ...mdx() }, react()] });
```

Declare the module so TypeScript checks the import, in `src/mdx.d.ts`:

```ts
declare module '*.mdx' {
  import type { EssayContent, EssayMeta } from '@mechane-ai/elements/mdx';

  const Content: EssayContent;
  export const meta: EssayMeta;
  export default Content;
}
```

Render it. Without a `view` prop, the address decides with `?view=present|static|sheet`:

```tsx
import { Essay } from '@mechane-ai/elements/mdx';
import Content, { meta } from './essay.mdx';
import { lesson } from './lesson.ts';

<Essay lesson={lesson} content={Content} locale="en-US" storageKey={lesson.id} {...meta} />;
```

`Essay` takes every `Article` prop except `children`, plus `content` and `components` (extra or replacement tags).

## The file

`export const meta = { title, authors?, date?, summary? }` at the top. Import your figures, then write beats. Leave a
blank line after an opening tag and before a closing one, so the Markdown inside is parsed as Markdown:

```mdx
export const meta = { title: 'Why a big learning rate blows up', summary: 'The numbers are synthetic.' };

import { LossCurve } from './figures.tsx';

<Beat id="rate">

Every step multiplies the loss by <Value name="factor" />. Press play to run ten steps.

<Playback name="steps" pace="slow" />

<Figure id="loss-curve" caption="Loss at each step." description="A line falling toward zero." reads={['rate']}>
  <LossCurve />
  <Transport for="steps" />
</Figure>

</Beat>
```

Never start a line of prose with a tag such as `<Value />`: put a word before it. A line that starts with a tag reads as
a block, and a formatter splits the paragraph there.

The rules of the `write-explainer` skill hold unchanged: figures are components in a `.tsx` file that read
`useLesson(lesson)`, and every `Figure` names what they read.

## Math

To write `$…$` and `$$…$$`, add `remark-math` to the MDX plugins (`mdx({ remarkPlugins: [remarkMath] })`) and pass a
typesetter as `math={(tex, { isDisplay }) => …}` to `Essay`, for example KaTeX's MathML output. Without a typesetter,
`TeX` shows the TeX source. Elements adds no typesetting dependency.
