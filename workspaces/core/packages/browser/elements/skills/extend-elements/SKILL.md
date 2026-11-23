---
name: extend-elements
description:
  Implement or change a shared component in the Mechane Elements source repository, including its UI SDK behavior,
  StyleX appearance, or agent-visible state.
---

# Extend Elements

Find the closest component in the owning family under `packages/` and read its public entry and story. When several
controls already provide the desired behavior together, compose them in a recipe. Add a shared component when the
library needs to own a repeated interaction or prevent an invalid combination of inputs.

For a new interaction, open `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` from the Elements package directory. This
is the guide for the pinned SDK. Use an existing UI SDK behavior where one fits. Keep one owner for keyboard, pointer,
and agent actions. Use the family's StyleX tokens and density choices and export the supported API from its public
entry.

## A UI SDK component first

Wrap the SDK component when one names the interaction, and add only the Elements styling and the supported props.

| The interaction                                 | Start from                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A row of controls with one Tab stop             | `@ui-sdk/react/toolbar`, as `packages/collections/src/control-toolbar.tsx`               |
| One choice from a short row                     | `@ui-sdk/react/segmented-control`, as `packages/forms/src/selection.tsx`                 |
| Choosing, dropping or pasting files             | `@ui-sdk/react/file-input`, as `packages/forms/src/file-picker.tsx`                      |
| A typed date                                    | `@ui-sdk/react/date-input`, as `packages/forms/src/dates/date-inputs.tsx`                |
| A region that follows new content to its end    | `@ui-sdk/react/scroll-area`, as `packages/ai/src/conversation.tsx`                       |
| Rows or cells with one Tab stop and a selection | `createGridFocus` and `createSelection`, as `packages/collections/src/table-results.tsx` |
| A long list that renders only what shows        | `createVirtualizer`, as `packages/collections/src/use-table-window.ts`                   |

A control that can sit in a toolbar or outside one reads the toolbar around it, as `useToolbarButton` does. A part of
the SDK toolbar throws outside its root.

## A primitive of your own

When no UI SDK component fits, define one primitive beside the component and keep every rule of the interaction in it.
`packages/charts/src/chart.tsx` and `packages/core/src/route-link.tsx` are the references.

```tsx
import { createChange, definePrimitive } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

type RatingOptions = {
  readonly value?: number | undefined;
  readonly defaultValue?: number | undefined;
  readonly onValueChange?: ((value: number, details: ChangeDetails<'item-press'>) => void) | undefined;
};

const rating = definePrimitive({
  name: 'rating',
  options: { value: 'number', defaultValue: 'number', onValueChange: 'callback' },
  controlled: ['value'],
  state: (options: RatingOptions) => ({ value: options.value ?? options.defaultValue ?? 0 }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);

    return {
      setValue: (value: number, event?: Event) =>
        change('value', value, event === undefined ? { reason: 'item-press' } : { reason: 'item-press', event }),
    };
  },
  slots: (slot) => ({
    root: slot({ role: 'group' }),
    star: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { key }) => ({ 'data-filled': Number(key) <= state.value ? '' : undefined }),
      press: ({ api, key }, event) => api.setValue(Number(key), event),
    }),
  }),
  agent: { actions: ['setValue'] },
});

const parts = createParts(rating, { root: 'div', star: 'button' });
```

- Name the primitive for what a reader calls it. An agent finds it by that name and by its accessible label.
- State an application owns goes in `controlled`, and every change to it goes through `createChange` with a reason and
  the event, leaving `event` out when there is none. Use `dispatch` for a request that is not state, such as asking the
  application to select a record.
- Put the role on the slot with `role`, never in `attrs`. Attribute values are strings. Style states through the data
  attributes the slot writes, such as `':is([data-filled])'` in StyleX.
- Always write the `agent` key. A component an agent only reads declares `agent: { actions: [] }`. One whose value is
  always one of its items adds `closed: true`, and returns the items as data when they are not rendered.
- Give a composite one Tab stop and move a cursor inside it. A press on a part leaves focus on the composite.
- Merge incoming props with `mergeProps` from `@ui-sdk/react/primitive`, with the StyleX output first.
- Keep the `definePrimitive` result private to its module. Export typed parts or a hook with an explicit return type,
  because the package build cannot name the primitive's inferred type.

Give interactive components a meaningful accessible name. Advertise actions only when the visible control can perform
them. Derive visible items and readings from the authorized data currently on screen. Route actions through the same
selection, navigation, or submit callback used by a person. The application supplies permissions, pending state,
accepted results, and errors. A requested change to a controlled value is complete when the owner supplies the new
state.

Check a representative task in the family story with keyboard and the public `/agent` bridge. Check what the agent sees
once the control is disabled, its selection changes, or its data is loading. For sensitive controls also inspect
compound snapshots and action results for private values. Update the page recipe if the preferred consumer composition
changes.
