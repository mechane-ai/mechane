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
- An icon-only button has an accessible name. A chart's title says what was measured and for which period. Review a
  chart further in section 8.

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

## 8. Figures

Run this pass on every page with a chart, a kit component or a figure spec. Look at the figure, then read its footnote
and its readout.

- **After a chart change, look at the wall first.** When you changed a chart in the Elements source, open `Charts/Wall`
  in the Elements Storybook before the page. It is one page that draws every registered chart from its `chartGuide`
  example through `Figure`, with one story per family and an `All` story. Compare the changed chart's frame, axes,
  ticks, legend, readout, footnote and states with its neighbors, in the light and dark themes and at phone width. A
  chart that looks different from the others there is wrong before any page uses it. The wall is part of the Elements
  Storybook, so an app with only the installed package has no wall. There, compare the figure with its `example` in
  `chartGuide`.
- **One hue per thing.** The same model, run or series has the same hue in every figure, table and sentence on the page.
  A `ToneScope` names the ids. A hue that changes between figures means an id differs or a scope is missing.
- **Linked figures answer together.** Inside a `ChartLink`, hover a row or a point and check that the same id is marked
  in each other figure. A figure that stays still has a different id for the same thing.
- **A spec from JSON validates.** For a figure drawn from a spec, `validateFigureSpec` returns `ok`, or the page shows
  its `message`. An invalid spec in the figure itself shows the same reason in place of the chart.
- **Declared formats and units.** Every number comes from a declared format with a `locale`, and every axis title names
  its unit. A time format names its time zone. No formatter function appears in the props.
- **Bars start at zero.** A bar, histogram or area that starts elsewhere misleads. Dots and lines may use a fitted
  range.
- **Log axes are named.** A log or symlog axis says so in its title. A log axis holds no zero or negative value.
- **Missing is hollow.** A missing value is a hollow mark, a gap or "Unavailable", never zero. A zero is drawn as zero.
- **Partial data states its coverage.** A sample or a window shows how much it draws, such as "1,000 of 48,000 points",
  beside the title.
- **Source and transforms in the footnote.** The footnote names where the data came from and each step the app applied:
  smoothing, binning, quantile method, sample.
- **One meaning per channel.** A dashed stroke is modelled, a pale band is uncertainty, gray is context, and size has a
  legend. No second value axis on one plot.
- **Reachable by keyboard.** The plot is one Tab stop. Arrow keys inspect, Enter selects, and Escape closes the readout.
  A range or a pan has a keyboard path.
- **Readout text is present.** The inspected record states its exact values in text, and the exact-value table lists
  every record.
- **Limits are respected.** The page stays inside each chart's `<chart>Limits` and names its window or aggregate. A
  chart that refuses input shows the reason, not a blank.
- **States match.** Loading holds the final geometry, empty says why, and invalid names the problem.
- **Dark theme and phone width.** In the dark theme, marks and labels keep their contrast. At 360 pixels, labels do not
  overlap, the readout stays in view, and the plot does not scroll the page sideways.
- **No statistic in the chart.** The app computed every quantile, density, bin and fit, with a named transform.

Not covered by this review: a real screen reader, a physical touch device and right-to-left text. Say so in the report
unless you ran them.
