# @mechane/browser

The guest's Chromium adapter operates tabs, returns observed controls and screenshots, and records reviewable video.

Layer 5 · node lane · effect dialect · consumer: `@mechane/guest`

## Use

The guest supplies `BrowserSettings` and owns the runtime's Effect scope. `BrowserRuntime.perform` accepts the typed
actions from `@mechane/sandbox-wire`. `readArtifactPart` transfers a completed capture, while `ownedProcessGroups`
exposes the children that the guest must suspend or stop. The conversation's existing model chooses the actions.
`readReceipt` recovers the original request and its saved result without starting Chromium or dispatching an action.

Chromium uses its native DevTools Protocol through a private Node WebSocket connection. Xvfb supplies its display.
Recording output is transcoded to H.264 MP4. No Playwright dependency or second model operates the browser.

## State

Profiles, browser HOME, and private request state use the supplied scratch directory outside the committed home.
Completed captures also stay in scratch storage, outside workspace checkpoints. Their absolute guest-local paths last
until the machine stops; the mech persists their bytes as private R2 evidence. Observations return transient previews
and targets, while explicit screenshots and recordings create evidence. Profile backup and restore are not provided.
This package does not grant portable exports or forks access to browser authentication state.

Element references belong to an observation and are rejected when stale. Diagnostics, tab count, image previews, and
recording size and duration are bounded in the shared wire. A repeated action identity reads its receipt; an interrupted
action without a confirmed result stays uncertain. Media capture does not assert an application test outcome.

## Lifetime

Chromium, Xvfb, and encoding children belong to the guest scope. The browser reports its owned process groups for
checkpoint suspension. A machine replacement cannot continue the old live tabs or process memory. Startup does not
silently disable the Chromium sandbox; that setting is explicit. Native desktop dialogs and human takeover are outside
the supported browser actions.

The [browser control](../../../.contracts/128-browser-control/CONTRACT.md) and
[evidence](../../../.contracts/129-browser-evidence/CONTRACT.md) contracts define the action and persistence boundaries.
