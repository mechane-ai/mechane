---
name: console-boundaries
message: Keep the console an ordinary client of the installation API, with bounded session-owned data and one release.
paths: ["packages/browser/**", "packages/worker/authentication/**", "packages/worker/pages/**", "packages/worker/app/**", "packages/node/distribution/**", "packages/node/stack/**", "infrastructure/**"]
---

## Rules

The console ships at `/console` in the same immutable release as the Worker. `/api/v1` owns runtime operations;
OpenTofu owns installations and upgrades, never individual mechs. API misses do not become HTML responses.

`console` owns routes, application composition, and the Storybook runner. `console-data` owns requests and reactive
state; `console-views` owns resource presentation and domain formatting. `ui-tokens` owns shared visual roles, `ui` owns
accessible controls and generic data presentation, `ui-layout` owns the shell and page layouts, and `ui-charts` owns
generic charts. Browser packages import only shared or lower browser packages. No browser package imports Worker, Node,
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
the originating list page. Refreshing activity preserves the rows being read until the reader requests the newer page.
The public entry contains no private snapshot. A transient read failure may retain the last authorized result; access
loss and removal clear it. A revision conflict preserves edited fields and accepts concurrent changes to untouched fields.

Compose every screen with the shared frame and toolbar. The frame owns presentation state for the sidebar and mobile
drawer; screens own their resource operations and toolbar actions. Keep lists flush with the content edges and use
the shared detail container for resource details and forms. Keep shell measurements with `ui-layout` and shared colors
and typography with `ui-tokens`. The shell owns outer separators; child actions own only their internal dividers.
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

## Evidence

Check browser and backend types, the production console build, package boundaries, and local runtime scenarios. Use a
real browser against the packaged celld Worker to verify sign-in/out, workspace isolation, a completed turn, trace
navigation, revision conflicts, and rejected cross-origin writes. Verify the Cloudflare release and an empty subsequent
OpenTofu plan before declaring an installation upgraded.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `oxc/no-optional-chaining` (113): enforced, `"error"`

<!-- End of the generated block. -->
