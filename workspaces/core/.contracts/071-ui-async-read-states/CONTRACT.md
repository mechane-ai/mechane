---
name: ui-async-read-states
paths: ["packages/browser/console/src/**","packages/browser/console-views/src/**","packages/browser/elements/packages/feedback/src/skeleton.tsx","packages/browser/elements/packages/feedback/src/async-region.tsx","packages/browser/elements/packages/collections/src/data-table.tsx","packages/browser/elements/packages/ai/src/prompt-input.tsx","packages/browser/elements/packages/foundations/src/tokens.stylex.ts"]
message: Present pending, empty, failed, and refreshing reads truthfully, without false empties, flashing loaders, or displaced content.
---

## Rules

Present each read as exactly one of pending, failed, or ready, with refresh status attached to ready data.
Treat a result that has not arrived as pending, never as empty or zero.
Show an empty or not-found view only after a successful read establishes that result.
Treat an open connection or subscription as pending until its first snapshot arrives.
Show a failed initial read as an actionable failure with a retry, never as an empty result.

Keep usable results visible while the same resource refreshes or reconnects for the same viewer.
Show refresh progress, and a refresh failure with its retry, beside the retained results.
Preserve focus and scroll position through pending, failed, and successful refreshes.
Show a newly selected resource as pending until its own result arrives, rather than keeping the previous resource's results on screen.

Delay placeholder visibility by one shared declared delay, so a fast read completes without a visible loader.
Do not impose a minimum loading duration or replay the loader on each refresh.
Render a result that is ready at mount, including a cached empty result, immediately and fully visible.
Reveal a view's heading, permission-dependent actions, and primary content together.

Reserve the space of pending content immediately, so its arrival does not move surrounding content.
Build placeholders from the same layout definitions as the loaded view for known headings, toolbars, columns, and control sizes.
Do not invent records, counts, or permissions to make a placeholder look complete.
Never mount a hidden form or editor only to measure it.
Show one loading indicator per region; nested regions must not stack fades or replace each other's loaders.

Hide decorative loading visuals from assistive technology and make them noninteractive.
Mark the pending region busy, and announce loading once, after the shared delay.
Do not let loading transitions move keyboard focus or delay failure or denial feedback.

## Checks

Hold a read pending beyond the shared delay, then release it, and confirm the placeholder appears only after the delay and the content does not shift surrounding layout.
Complete a read faster than the delay and confirm no loader appears.
Exercise a successful empty read, a failed initial read, a failed refresh after success, and a resource switch, and confirm each shows its own state.
Reopen a cached populated view and a cached empty view, and confirm both appear immediately at full visibility.
Compare held-pending and loaded views at the same viewport for heading, row, and control positions.
Inspect the pending region in the accessibility tree for its busy state and a single announcement.

## Local adaptations

`packages/browser/console/src/resource.tsx` projects reads into pending, failed, or ready presentation. It owns the
distinction between initial failure and stale retained data. Screens supply a required placeholder composition with
the loaded view's layout.

The upstream instruction to show refresh progress applies visibly to an explicit refresh action: its control exposes
the pending state immediately. Periodic background reads may stay visually quiet while retaining refresh state for
their consumers. Both paths keep usable content mounted and report a refresh failure with its retry beside that content.
Keep pagination failure and retry state beside their controls, including during a retry. A long list must not put the
only recovery affordance above the reader's visible region.

Sidebar navigation label enrichment is the narrow exception to refresh-failure presentation: a transient refresh
failure may keep the usable native link and its last-known name without a separate error or retry control. An initial
failure shows an unavailable label. Denied or deleted records still clear the protected label and shortcut. This
exception does not apply to the opened record, activity, usage, or other result surfaces.

Elements owns loading visibility and reveal motion in `feedback/src/async-region.tsx`. Use the shared `loading.delaySeconds`,
`loading.placeholderMs`, and `loading.revealMs` definitions. Reserve the pending layout immediately and
keep its decoration invisible until the delay expires. A result ends pending presentation as soon as it is available;
neither the delay nor an unfinished placeholder fade imposes a minimum dwell. Failed reads and action feedback appear
immediately. Cached ready content starts fully visible.

The Console route owns `LoadingScope` identity. Its initial page reads share one elapsed clock instead of restarting
the delay as each dependent read mounts. The application coordinates the heading, resource actions, and selected
view's primary content before their single reveal. Optional reads report their own state without delaying the primary
view or restarting its reveal. The neutral shell may reserve space before authorization, but must not imply records,
counts, or permissions that have not arrived.

Only `resource.tsx` and `entrance.tsx` import `AsyncRegion` or `ContentReveal` in the Console. Only `routes/__root.tsx`
imports `LoadingScope`. Screens and console-views compose static placeholders and consume the resource boundary;
they do not add their own loading clock, delay, or reveal. Use named feedback imports so these owners remain explicit.

Changing loading identity resets pending presentation without keying or remounting ready children. Skeleton text
reserves inherited line boxes; tables and their placeholders share column layout definitions. Generic components do
not inspect document startup markers or router state. Keep the same view's content, viewport, and controls mounted
during refresh; loading visibility never owns the lifetime of a form or editor.

Contract 113 still owns clearing data after an access or workspace change. Retaining a result during a refresh never
authorizes showing data from another resource or viewer.

TypeScript checks the required placeholder and `AsyncRegion`'s pending/ready/failed prop union. The registry checks
Console loading imports, not rendered geometry or asynchronous behavior. In the packaged browser, hold startup and
dependent reads separately, then verify one delay and one primary reveal. Compare viewport and composer bounds before
and after ready; fail and recover a same-view refresh while preserving scroll, focus, and a draft.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `console-loading-boundary` (071): enforced
- ast-grep `console-loading-boundary-typescript` (071): enforced
- ast-grep `console-loading-scope` (071): enforced
- ast-grep `console-loading-scope-typescript` (071): enforced

<!-- End of the generated block. -->
