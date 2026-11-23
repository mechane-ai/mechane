---
name: review-elements
description:
  Review a page built with Mechane Elements before it ships. Use after building or changing UI with
  `@mechane-ai/elements`, or when asked to check keyboard access, loading states, narrow layouts, themes or agent
  access.
---

# Review an Elements page

Run the page in a browser and use it. A passing type check says nothing about focus, loading or layout. Report what you
checked, what failed and what you could not check.

## 1. Keyboard alone

Put the pointer away and complete the page's main task.

- Tab reaches every control once, in reading order, with a visible focus ring.
- A table's row actions, a control row, a chart, a timeline, tabs and a segmented control are each **one** Tab stop.
  Arrow keys move inside them. Another Tab stop inside one of these means a wrapper is fighting the component.
- Enter or Space activates. Escape closes the top layer only: a readout before its dialog, a menu before its drawer.
- Closing a dialog, menu or popover returns focus to what opened it. After a save, focus lands on the result.
- Text entry keeps its keys. A shortcut does not fire while the reader types.

## 2. Every read state

Hold a slow read, fail one, and return an empty result.

- Pending reserves the result's geometry with a matching placeholder. Nothing jumps when the content arrives.
- A refresh keeps the last result, its focus and any draft on screen, with progress or the failure beside it.
- A failed first read shows a `Notice` with Retry in place. A successful empty result shows an `EmptyState`.
- Each failure has one presentation. Not a banner and a toast for the same error.
- Navigate away mid-read. A late response must not replace the new selection's content.
- A pending save disables a second submit. A failed save keeps the draft.

## 3. Width and pointer

Check 360 pixels wide, a tablet width and a wide desktop.

- The page never scrolls sideways. A wide table or plot scrolls inside its own region.
- Toolbar actions wrap below their title. Long labels wrap or truncate with the full value available elsewhere.
- With a coarse pointer, standalone controls give 44px targets and text fields use 16px text.
- At a wide viewport, the right edges of a report header, its table and the pane line up.

## 4. Theme and motion

- Switch to the dark theme and open every menu, dialog, popover and tooltip. A portaled panel in the wrong theme means
  the theme is not on the document root.
- Turn on reduced motion. Fades and slides stop, and nothing waits for an animation to finish.

## 5. Honest content

- Unknown is not zero. A missing value shows as unavailable, and a chart draws a gap.
- Try the longest real name, a large number, an empty optional field and a single row.
- Dates and numbers carry a unit, and come from a formatter with an explicit locale and time zone.
- An icon-only button has an accessible name. A chart's title says what was measured and for which period.

## 6. What an agent sees

When the app enables the bridge from `/agent`, print `agent.snapshot()` on the page.

- Every component has a label a person would recognize.
- The listed actions match what the visible controls can do right now. A disabled control offers no action.
- No credential, private draft or hidden record appears in a label, an item or a result.
- A step an agent takes produces the same request and the same pending state as a person's press.

## 7. Read the code once

- Imports come from `@mechane-ai/elements` entries. No second component library renders the same kind of control.
- No class or inline style changes a control's size, padding, radius or focus ring. `xstyle` carries placement only.
- No custom `onKeyDown`, tooltip or scroll effect duplicates what the component already does.
- Each value has one owner: controlled with its callback, or an uncontrolled default.
- The server authorizes every read and mutation. The UI's disabled state is not the permission check.

Not covered by this review: a real screen reader, a physical touch device and right-to-left text. Say so in the report
unless you ran them.
