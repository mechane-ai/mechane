---
name: console-boundaries
message: Keep the console an ordinary client of the installation API, with bounded session-owned data and one release.
paths: ["packages/browser/**", "packages/worker/authentication/**", "packages/worker/pages/**", "packages/worker/app/**", "packages/node/distribution/**", "packages/node/stack/**", "infrastructure/**"]
---

## Rules

The console ships at `/console` in the same immutable release as the Worker. `/api/v1` owns runtime operations;
OpenTofu owns installations and upgrades, never individual mechs. API misses do not become HTML responses.

`console` owns routes, application composition, and the Storybook runner. `console-data` owns requests and reactive
state; `console-views` owns resource presentation and domain formatting. `@mechane-ai/elements` owns shared visual roles,
accessible controls, generic data presentation, layouts, and charts behind its declared public entry points. Browser packages import only shared or lower browser packages. No browser package imports Worker, Node,
private Factory, or installation credentials.

The shared client validates wire data. TanStack DB collections describe bounded server pages or individual resources;
one loaded page must not be presented as an exhaustive dataset. Session or workspace changes cancel pending reads,
dispose collections, and clear caches. Commands wait for
server acknowledgement, retain request IDs across uncertain retries, and use revision checks for definition changes.
Revisiting a page must not reuse a collection ID for a different instance while its querying hook remains mounted.
Each released collection cancels and removes only its own query.

Browser sessions use the existing HttpOnly, same-site cookie. Unsafe cookie-authenticated API requests require the
installation's exact Origin. Explicit bearer credentials never fall back to cookies. Authorization always resolves the
current principal and workspace membership on the server. Signing out revokes the server session.

Model replies and tool output are untrusted text. Render them as text or through a deliberate safe renderer. Never
embed secret values, raw credential-bearing tool arguments, or private runtime configuration in traces or browser assets.

Trace intervals name their measured boundaries. Reservation-to-settlement time is not provider inference time;
missing usage is unknown, never zero. Show recorded turn events through a bounded API page, not a filtered page of
unrelated recent activity. The event query includes the original receipts of the turn's inputs.

A turn overview reads its bounded reply excerpt and exact event sequence from that turn's durable log. The full reply
remains reachable when it falls beyond the first event page. A message receipt identifies a turn only after a matching
start or join event. A cancellation receipt precedes the recorded terminal outcome.

Record links reopen the selected workspace, mech, turn, request or event. Returning through browser history restores
the originating page, its focused record, and the position in its actual scrolling region. Run inspection occupies a
full page and temporarily hides workspace navigation without changing the saved sidebar preference. Preserve the
same mech's conversation and draft while inspecting its runs. A direct run link has a usable return to its mech even
without an originating history entry. Refreshing activity preserves the rows being read until the reader requests the newer page.
The public entry contains no private snapshot. A transient read failure may retain the last authorized result; access
loss and removal clear it. A revision conflict preserves edited fields and accepts concurrent changes to untouched fields.

Separate workspace navigation from pinned and recently opened mechs. Recent shortcuts follow explicit visits, not
the order of a bounded mech-list page. Keep browser-local shortcuts and appearance preferences scoped to the principal
and workspace. Persist identifiers and presentation choices, not protected record content. Resolve shortcut records
through the normal authorized reads; prune confirmed unavailable records without treating a transient failure or
absence from one list page as removal.

Compose every screen with the shared frame and toolbar. The frame owns presentation state for the sidebar and mobile
drawer; screens own their resource operations and toolbar actions. Keep lists flush with the content edges and use
the shared detail container for resource details and forms. Keep shell measurements with the Elements layout family
and shared colors and typography with foundations. The shell owns outer separators; child actions own only their internal dividers.
Navigation controls expose their names in collapsed and mobile states. Storybook examples use the same frame and
presentation components as the application. Generic component requirements belong to contracts 065–075 and 114–115.

Both celld and Cloudflare serve the same verified asset inventory. The installation manifest binds the console and
Worker digests; failed or incomplete asset uploads must not activate a new Worker. Public source includes every browser
package, its development tools, and dependency notices.

## Local adaptations

The browser lane uses ordinary React and Promise conventions. Conditional JSX, nullish values, namespace imports
required by StyleX, conventional UI identifiers, callback arguments, and inferred framework return types are allowed.
Component names, typed props, and Storybook states document ordinary presentation exports; comments explain non-obvious behavior. Module augmentation keeps the interfaces required by the router. Components still have typed props; shared transport schemas, strict TypeScript, dependency boundaries, linting, and
accessibility checks apply. Backend Effect and storage rules retain their existing scope.

Only `console-data/src/api.ts` runs shared Effects and translates their typed failures to rejected Promises.
Presentation code does not introduce a second error transport. The generated TanStack route map is regenerated by
the pinned build plugin, ignored by authored-source checks, and still consumed by the browser typecheck and build.
The resource-query owner in `console-data/src/console-data.ts` uses native async callbacks. It may catch a rejected read
to clear data after access loss or removal, then rethrow the same failure so TanStack retains its error state.
This query exception does not permit running Effects outside the API adapter or swallowing a failed read.

The Console's navigation owner applies the same run-entry policy to links and programmatic navigation. Capture the
origin when entering a run; changing its request, event, or subview preserves that origin and replaces the current run
entry. Modified clicks and links targeting another tab retain native link behavior without changing the current
reader's history state.

Selecting a work record replaces the list with its detail and provides a return to the originating row. Selecting a
model request makes its evidence reachable without scrolling past the entire request collection. Keep the selected
record's identity separate from its position in a bounded page. Supplied memory and event provenance links to the
identified run; do not substitute the latest run.

Show trace-wide evidence limits beside the trace summary across all subviews. A complete-looking overview must not
hide unavailable or truncated evidence in a different tab. Use recorded endpoints for tool duration; an absent endpoint
does not become a zero-duration step.

## Evidence

Check browser and backend types, the production console build, package boundaries, and local runtime scenarios. Use a
real browser against the packaged celld Worker to verify sign-in/out, workspace isolation, a completed turn, trace
navigation, revision conflicts, and rejected cross-origin writes. Verify the Cloudflare release and an empty subsequent
OpenTofu plan before declaring an installation upgraded.

Open a run from a scrolled conversation and a later list page, then use browser Back and the run's return control.
Check row focus, scroll position, draft text, and the sidebar preference. Open the same run URL in a new tab.
Switch principal or workspace and confirm shortcuts and appearance choices stay within their owner. Exercise a
shortcut outside the first mech page, a rejected access read, and a transient read failure.

From one run, select requests and original reply events through both links and controls, then return once to the
originating view. Repeat with a modified click and a new-tab link. Open a later work row, return to its list, and open a
memory or history source run. With a long request collection, select its last row at desktop and narrow widths. Confirm
the selected evidence is reachable, focus can return to its control, and supplied trace limits remain visible on every tab.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `oxc/no-optional-chaining` (113): enforced, `"error"`

<!-- End of the generated block. -->
