# Working on this essay

- The essay is `src/essay.mdx`; the lesson it teaches is `src/lesson.ts`; the figures are `src/figures.tsx`.
- Plan first. Edit `plan.json` until "Lesson checks" shows no errors, then carry it into `lesson.ts`.
- Describe states, never animations. Give a beat `states` of param values and let the components move there.
- Every beat needs a `goal`, a `<Figure>` with a `description`, and at least one state. Tutor notes stay in `lesson.ts`.
- Write values into sentences with `<Param name="…" />` and `<Value name="…" />`. Never copy a number into the prose.
- Never start a line of prose with a tag such as `<Value />`. Put a word before it, or a formatter splits the paragraph.
- Elements parts need no imports in the MDX file: `Beat`, `Figure`, `Scene`, `Predict`, `Challenge`, `Aside`,
  `Footnote`.
- Figures are components in `src/figures.tsx` that read `useLesson(lesson)`. Draw with Elements charts and `Scene`.
- After every change run `pnpm check`, then open `/?view=sheet` and read its "Checks" list. Fix every item.
- Say in the essay that synthetic data is synthetic. Do not call a paid model or a cloud account from the essay.
- Install the skills with `pnpm skills`, and use `explainerGuide` from `@mechane-ai/elements/lesson/spec` to pick parts.
