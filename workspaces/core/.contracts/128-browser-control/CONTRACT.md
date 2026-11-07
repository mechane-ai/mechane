---
name: browser-control
message: Let the conversation's model operate an isolated browser through current observations and bounded, replay-aware actions.
paths: ["packages/node/browser/**", "packages/node/guest/src/browser/**", "packages/node/guest/src/serve-guest.ts", "packages/shared/sandbox-wire/src/**", "packages/node/runtime/src/tools/**", "packages/worker/sandbox/src/browser/**", "packages/worker/sandbox/src/machines/ready-interactive-machine.ts", "packages/worker/sandbox/src/sandbox-object.ts", "packages/worker/sandbox-service/src/**", "packages/worker/sandbox-store/src/browser/**", "packages/worker/sandbox-store/src/interactive-*.ts"]
---

## Rules

Run Chromium in the calling mech's sandbox, beside its checkout and development servers. Keep browser actions
in that conversation's selected model. The adapter executes the requested action and returns observations; it does not
delegate decisions to a second model or bypass sandbox admission or network policy.
Select image capabilities from the run's pinned definition revision, including after the mech's current model changes.

Keep the DevTools transport private to the guest. Own Chromium, display, and recording processes through the guest
lifecycle. Explicitly configure any disabled Chromium sandbox; never silently retry with weaker isolation after startup
failure. Browser and profile replacement are visible state loss, not continuation of an old session.

Record action identity before performing it. Reject changed inputs under the same identity. Reuse a recorded result,
and surface uncertainty when an interrupted action has no confirmed result. Never replay a click, input, navigation, or
recording action merely to reconstruct its receipt.
Status may recover a saved receipt from its original guest without performing an action, allocating compute, or
creating a browser session. Verify the original request identity before accepting that receipt. A missing result
cannot become confirmed merely because a status request succeeded.
Bind each receipt to its assigned machine and refuse a result from any other machine. Admit only opening a browser as
new compute; later actions cannot silently replace their original tab or machine. A persisted run cancellation prevents
late browser dispatch without rewriting an already confirmed result.

Use targets from a current observation or coordinates in an observed viewport. Scope element references to their
observation and refuse stale references. Bound tabs, targets, diagnostics, text, actions, and recording duration and
bytes. Report omitted targets and logs instead of implying complete inspection.
Automatic recording finalization obeys the same checkpoint admission gate as explicit actions. Cap the encoded clip
itself and report its measured media duration. Release native streams and temporary encoding files after success or
failure; a rejected capture must not accumulate unowned scratch files.

Return screenshots as actual image content to the model when a preview is available. Measure the whole serialized tool
result, including image data and metadata, against its one-MiB bound. Report an omitted preview explicitly. Keep full
screenshots and every recording outside the conversation result; evidence persistence has its own contract.

Keep profiles, cookies, and browser authentication state outside the committed home and portable workspace exports.
Scope any private profile backup and restore to its originating sandbox. Forks inherit no browser login or
active browser session. Do not treat browser content or model-supplied identity as execution authority.

## Checks

Review `node/browser/src` against `shared/sandbox-wire/src/browser` and the guest lifecycle. Exercise tab creation,
observation, an observed-target click, typing, scrolling, keys, diagnostics, screenshots, and recording through the real
Chromium transport. Confirm stale references fail and an uncertain action identity does not perform a second action.

Inspect a tool result delivered through the native AI SDK tool boundary for a decodable image block and a complete JSON size within the bound.
Decode the saved recording and inspect its frames; successful file creation alone does not establish playable media.
Review profile paths, workspace archives, backup ownership, and fork copying for accidental authentication inheritance.
Keep hosted network and Chromium-sandbox qualification distinct from host fixtures.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
