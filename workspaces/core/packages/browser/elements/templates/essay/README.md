# An explorable essay

One MDX file is the essay. `src/lesson.ts` declares what the reader can change, `src/figures.tsx` draws it, and
`src/essay.mdx` is the prose, with `<Param>` and `<Value>` in the sentences and `<Figure>` between them. The subject is
small and true: why a learning rate above 1 makes gradient descent on `w²` blow up. Its numbers are synthetic.

## Run

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # types, including the .mdx import
pnpm build
```

## Four views of the same file

Add `?view=` to the address. Every view renders the same essay.

| Address          | What it is                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `/`              | The scrolling essay with a contents list that follows the reader.                            |
| `/?view=present` | One beat at a time. Right or Space goes on, Left goes back.                                  |
| `/?view=static`  | Every beat open at its first state, each figure followed by its description. Print this one. |
| `/?view=sheet`   | The beat sheet: every beat in each of its declared states, then a list of checks.            |

## Check the beat sheet

Open `/?view=sheet` after every change. Each beat appears once per state in `src/lesson.ts`, so you see what the reader
sees without moving a slider. The "Checks" list under it names a beat with no figure, a player with no transport, a
value in prose that no figure reads and a figure with no description. Fix each one. Under the essay, a "Lesson checks"
list shows what `checkLesson(lesson)` and the plan still get wrong.

## Plan before you write

`plan.json` is the lesson as plain data. Change it first: the "Lesson checks" list under the essay shows every finding
with a path and a sentence, and an error means `defineLesson` would refuse the plan. The plan's params and beats carry
over to `src/lesson.ts` unchanged.

## Skills for a coding agent

```sh
pnpm skills
```

copies the Elements skills into `.claude/skills`. `explainerGuide` from `@mechane-ai/elements/lesson/spec` lists every
teaching part with the question it answers. `AGENTS.md` tells an agent how to work on this essay.

## Math

The essay has no formulas, so it needs no typesetter. To write TeX, install `remark-math` and a typesetter such as
KaTeX, add `remarkPlugins: [remarkMath]` to `mdx()` in `vite.config.ts`, and pass `math={(tex, { isDisplay }) => …}` to
`<Essay>` in `src/main.tsx`. Then `$w^2$` and `$$ … $$` in the file reach `<TeX>`. Without a typesetter, `<TeX>` shows
the TeX source.

## Make it yours

Rename the lesson and beats, replace the figures, and rewrite the prose. Keep the beat ids in `lesson.ts` and
`essay.mdx` the same, and keep the sentence `The numbers are synthetic` only while they are.
