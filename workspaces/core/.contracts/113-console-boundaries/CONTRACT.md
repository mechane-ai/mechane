---
name: console-boundaries
message: Keep the console an ordinary client of the installation API, with scoped session-owned data and one release.
paths: ["packages/browser/**", "packages/node/server/**", "packages/node/distribution/**", "packages/node/stack/**", "infrastructure/**"]
---

## Rules

The console ships at `/console` in the same immutable release as the Node service. `/api/v1` owns runtime operations;
OpenTofu owns installations and upgrades, never individual mechs. API misses do not become HTML responses.

`console` owns routes, application composition, drafts, and the Storybook runner. `console-data` owns admission,
requests, canonical records, page membership, and acknowledged commands. `console-cache` owns native persistence
composition and the file lifecycle under [contract 119](../119-console-cache-lifecycle/CONTRACT.md).
`console-views` owns resource presentation and domain formatting. `@mechane-ai/elements` owns shared visual roles,
accessible controls, generic data presentation, layouts, and charts behind its declared public entry points. Browser packages import only shared or lower browser packages. No browser package imports Worker, Node,
private Factory, or installation credentials.

The shared client validates wire data. Within one admitted installation, principal, and workspace, each record kind
has one canonical TanStack DB collection. A record key includes its resource owner when its identifier is only locally
unique. Pages hold ordered record identities and continuation metadata separately from canonical record values.
Receiving a newer record updates its readers without silently changing the membership of a page they are reading.
One loaded page or the union of loaded pages never establishes an exhaustive dataset.

Use each tab's native TanStack Query observers for demanded API reads, polling, focus refresh, errors, and retries.
Keep their successful result a completion scalar. Canonical records and exact page receipts belong only to TanStack DB;
the native browser coordinator replicates those collections, not a tab's network-request state.
Use entity and page reads whose server API supplies the required bounds. Preserve
the server's cursor, ordering, and coverage meaning. `showTurn` returns its selected turn's dispatch collection without
a server page bound. Merge its turn into the canonical turn collection and retain the remaining trace evidence in one
document. `listSlackBindings` returns the workspace's binding collection without pagination. Keep these API coverage
limits explicit. Slack deliveries expose only the latest bounded window, without a continuation cursor. These API
exceptions do not authorize an eager download of another resource's history or a custom query or synchronization engine.
Server reads are on demand. Canonical record and receipt tables restore their retained local rows eagerly
within contract 119's per-scope age and size limits; this local hydration is not a claim that every SQLite read uses a
bounded subset or that the cache holds complete server history.

Hold a native Web Lock for each exact request from its HTTP fetch through receipt publication. Scope the lock to the
cache generation and request identity. This orders unversioned snapshots of the same request across tabs; unrelated
requests remain parallel. Canonical updates use contract 119's shared write admission before evaluating domain guards.

Authentication-session or workspace changes cancel pending reads and dispose the prior runtime. Persistent copies become available
only through contract 119's fresh admission gate for each runtime. `console-data` owns that gate for workspace returns
and cache recovery as well as initial entry; a retained application session cannot authorize a replacement runtime.
Within one runtime, returning to a page reuses its canonical records and native collection instances. Releasing a page
removes only its own read subscription; it does not clear another page's canonical records or query.
On browser page suspension, dispose the data runtime. A Back/Forward cache restoration creates a newly admitted runtime
for the current route and cursors. Keep drafts and navigation preferences outside that lifetime.

Commands settle from the server acknowledgement. A later refresh, collection update, or cache failure reports its own
degradation without reversing that outcome or repeating the command. Retain request IDs across uncertain retries and
use revision checks for definition changes. Keep drafts, submitted text, pending request identity, and acknowledged
outcomes outside the replaceable data runtime. Cache recovery must not clear or resubmit them.

Expose the standard AI SDK UI message stream. Convert native model-call chunks through the upstream transform and
apply replay cursors to resulting UI chunks. Authorize every initial and resumed stream against current membership.
Server-owned history supplies model context; a client cannot submit privileged prior messages or tool results.
Treat every new resource screen, picker, and report as a canonical record consumer. Add its protocol-backed row to
`console-data/src/records.ts`, native table to `collections.ts`, and bounded request to `requests.ts` and `load-read.ts`.
Compose its view through the shared live-read hooks in `console/src/reads.ts`, preserving exact receipt membership,
readiness, refresh errors, and owner disposal. React state holds cursor inputs and interaction state, never fetched
record pages. Conversation session metadata follows this path too; it is distinct from transcript messages.

The complete domain-record transport exceptions are fresh principal/workspace admission in `console-data/src/session.ts`
and the runtime admission gate, plus the native chat protocol below. Adding another exception requires a contract change,
a corresponding boundary update where enforceable, and a real browser check of its authority and lifetime.
Authenticated evidence bytes use native browser image/video loads. Their metadata follows the canonical record path.

The native chat transport owns conversation HTTP and stream resumption. TanStack Query remains the owner of demanded
domain-projection reads; it does not become a parallel transport for the active transcript.

The browser's native AI SDK chat owns its loaded transcript and active streamed state. Server history is authoritative.
TanStack owns session catalogue metadata and the other canonical domain projections, not a mirrored transcript. Completion refreshes those projections
without appending the same message to a competing message store. Scope disposal fences
pending stream completions; a cache or renderer failure never reissues an acknowledged command.

Conversation selection uses a real session identity in the URL. Without an explicit selection, open the latest
existing session and show its source. A Slack session is read-only in Console with a link back to Slack; switching to
the Console conversation selects its actual console-source session. The server accepts Console submissions only for
that source. Never silently inject a Console message into a Slack conversation or invent a UI-only session.

Within the same admitted principal and workspace, retain a bounded set of native chat instances across mech and run
navigation. Eviction and scope loss abort their transports. Completion refresh merges messages by canonical identity
without dropping an assistant message not yet present in the history read. Authentication loss disposes both chat and
domain-data lifetimes, so late stream callbacks cannot restore protected content.

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
reader's history offset after asynchronous content mounts. The navigation owner derives scroll-region identities from
the admitted data scope and resource; different mechs and runs must not share a region identity. Preserve the
same mech's conversation and draft while inspecting its runs. A direct run link has a usable return to its mech even
without an originating history entry. Refreshing activity preserves the rows being read until the reader requests the newer page.
The public entry contains no private snapshot. A transient read failure may retain the last authorized result; access
loss and removal clear it. A revision conflict preserves edited fields and accepts concurrent changes to untouched fields.

Separate workspace navigation from pinned and recently opened mechs. Recent shortcuts follow explicit visits, not
the order of a bounded mech-list page. Keep browser-local shortcuts and appearance preferences scoped to the principal
and workspace. Shortcut and appearance storage contains identifiers and presentation choices; protected record copies
belong only to the admitted cache in contract 119. Resolve shortcut records
through the normal authorized reads; prune confirmed unavailable records without treating a transient failure or
absence from one list page as removal.

Identify personal and shared workspaces from the server's explicit `kind`, never their list position. An explicit
workspace URL wins over a remembered valid choice. Without either, open a single shared workspace before the personal
workspace; offer a chooser when several shared workspaces exist. Keep the Personal label correct when the server
changes workspace ordering.

Compose every screen with the shared frame and toolbar. The frame owns presentation state for the sidebar and mobile
drawer; screens own their resource operations and toolbar actions. Keep lists flush with the content edges and use
the shared detail container for resource details and forms. Keep shell measurements with the Elements layout family
and shared colors and typography with foundations. The shell owns outer separators; child actions own only their internal dividers.
Navigation controls expose their names in collapsed and mobile states. Storybook examples use the same frame and
presentation components as the application. Generic component requirements belong to contracts 065–075 and 114–115.

Local and hosted services serve the same verified asset inventory. The installation manifest binds the console and
server digests; failed or incomplete asset publication must not activate a new service. Public source includes every browser
package, its development tools, and dependency notices.
The build collects notices from its main application and nested Worker bundles into the shipped license asset.
Retained native WASM legal notices join that asset, and missing required text fails the build. The Node-only build
helper belongs to the exact configuration owner in contract 101, outside application imports.

## Local adaptations

The browser lane uses ordinary React and Promise conventions. Conditional JSX, nullish values, namespace imports
required by StyleX, conventional UI identifiers, callback arguments, and inferred framework return types are allowed.
Component names, typed props, and Storybook states document ordinary presentation exports; comments explain non-obvious behavior. Module augmentation keeps the interfaces required by the router. Components still have typed props; shared transport schemas, strict TypeScript, dependency boundaries, linting, and
accessibility checks apply. Backend Effect and storage rules retain their existing scope.

A browser React subscription may initialize one local boolean guard and set it false from its cleanup callback to
invalidate asynchronous completion notifications. This replaces contract 015's loop-only reassignment baseline for
that subscription-lifetime guard, as used by `mech-page-reads.ts` and `use-mech-navigation-resource.ts`. Keep the guard
with its subscription and cleanup; this allowance does not cover counters, branch-selected values, or module state.

Only `console-data/src/api.ts` runs shared Effects and translates their typed failures to rejected Promises.
Presentation code does not introduce a second error transport. The generated TanStack route map is regenerated by
the pinned build plugin, ignored by authored-source checks, and still consumed by the browser typecheck and build.
The runtime and query owner in `console-data/src/console-data.ts` uses native async callbacks. It may catch a rejected
read to clear data after access loss or removal, then rethrow the failure so TanStack retains its error state.
It also owns bounded disposal and recovery from failed local persistence. Its native read readiness operation in
`console-data/src/read-ready.ts` may catch a rejected read, repair, or cancellation to release its subscriptions,
report local failures, and preserve the original failure. Revocation stays with the runtime owner.
The canonical writer in `console-data/src/collections.ts` may catch a failed native write to retire its uncertain
generation before releasing write admission, then preserve the failure for its caller.
`console-data/src/commands.ts` may catch a post-acknowledgement local failure to record degradation while returning
the acknowledged result.
These exceptions permit neither running Effects outside the API adapter nor treating a failed server command as a success.

The admission invalidation broadcast in `console-data/src/console-data.ts` permits one
`unicorn/require-post-message-target-origin` site suppression: `BroadcastChannel.postMessage` has no target-origin
argument and its channel is already origin-scoped. Its decoded payload identifies the principal and affected resource
scope. It carries access invalidation, never replicated records or Query state.

The route owns page loading identity, `resource.tsx` owns read-state presentation, and Elements owns the visibility
clock and reveal. Coordinate the reads needed for the current heading, actions, and primary content at the application
owner. Independent activity and auxiliary reads do not gate that view. Use contract 071's required placeholder and
shared timing policy throughout startup, page entry, and resource navigation; a screen does not invent another loader.
Loading identity is not a React key for the page's ready children. Same-owner refresh and presentation changes retain
mounted content; a real principal, workspace, or resource change still clears the prior owner's protected state.

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

Environment controls observe exact managed-process handles without waking a machine or extending its lease. Load logs
for the selected handle, preserve terminal output, and retain keyboard focus when Stop removes its own control.
Evidence opens in a full-page viewer. Preserve the native session, draft, reader scroll, and originating link when
returning; a direct evidence link selects its recorded session and returns to its run without a history loop.
Pending and ready media share one frame. Canonical evidence metadata belongs to the domain data owner; native Chat
continues to own the session transcript and stream. Neither media bytes nor another transcript copy enter TanStack.

Check browser and backend types, the production console build, package boundaries, and local runtime scenarios. Use a
real browser against the packaged service to verify sign-in/out, workspace isolation, a completed turn, trace
navigation, revision conflicts, and rejected cross-origin writes. Verify the hosted Node and compute release identities and an empty subsequent
OpenTofu plan before declaring an installation upgraded.

Review a new feature from API demand through its canonical table, exact receipt, live projection, and presentation.
Verify successful empty results, warm reload, failed refresh with retained content, and access loss. For paginated
pickers, load another page without dropping earlier choices; reopening must use the normal read lifecycle. The import
boundary prevents screens from owning Query observers, but does not prove every displayed value's provenance.

Open a run from a scrolled conversation and a later list page, then use browser Back and the run's return control.
Check row focus, scroll position, draft text, and the sidebar preference. Open the same run URL in a new tab.
Switch principal or workspace and confirm shortcuts and appearance choices stay within their owner. Exercise a
shortcut outside the first mech page, a rejected access read, and a transient read failure.

From one run, select requests and original reply events through both links and controls, then return once to the
originating view. Repeat with a modified click and a new-tab link. Open a later work row, return to its list, and open a
memory or history source run. With a long request collection, select its last row at desktop and narrow widths. Confirm
the selected evidence is reachable, focus can return to its control, and supplied trace limits remain visible on every tab.

Delay startup, the selected view's primary read, and an auxiliary read independently. Confirm the neutral shell stays
stable, primary content reveals together, and auxiliary state cannot block it. Repeat from cached content and through
a failed same-view refresh. Loading must not reset a draft, selection, originating history entry, or scrolling region.

Open overlapping pages and the same record through a detail read. Change that record and confirm that all readers
receive its canonical value while a held page keeps its ordered membership. Advance the page only through its declared
refresh or pagination action. Fail refresh and persistence after an acknowledged command, then replace the data runtime.
Confirm that the outcome, a later draft, and an uncertain submission's request identity retain their application owner.
Repeat recovery after a persisted Back/Forward cache restoration from a different route. Confirm current-page reads,
drafts, focus, scroll position, and browser-local preferences survive while admission is checked again.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `console-build-owner` (113): enforced: Import Console build helpers only from its build configuration, such as `worker-licenses.ts` in `vite.config.ts`
- dependency-cruiser `console-api-owner` (113): enforced: Import the Console data owner for browser requests, such as `@mechane/console-data`
- dependency-cruiser `console-query-owner` (113): enforced: Keep Query observers in the data runtime; screens use canonical reads, such as `useSessions`
- oxlint `unicorn/require-post-message-target-origin` (113): enforced, `"error"`
- oxlint `oxc/no-optional-chaining` (113): enforced, `"error"`

<!-- End of the generated block. -->
