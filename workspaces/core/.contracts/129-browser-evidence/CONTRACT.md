---
name: browser-evidence
message: Preserve browser captures as private, authenticated artifacts with truthful provenance and explicit persistence outcomes.
paths: ["packages/shared/records/src/evidence*.ts", "packages/shared/protocol/src/operations/evidence/**", "packages/shared/protocol/src/pages/*evidence*.ts", "packages/worker/sandbox-store/src/evidence/**", "packages/worker/sandbox/src/evidence/**", "packages/worker/sandbox/src/service/**", "packages/worker/runtime/src/tools/**", "packages/worker/runtime/src/operations/evidence.ts", "packages/worker/server/src/**", "packages/node/browser/src/browser-{artifacts,recording,provenance}.ts", "packages/node/browser/src/store/**", "packages/browser/console-data/src/**", "packages/browser/console-views/src/{evidence,trace}.tsx", "packages/browser/console/src/{console-route,navigation,router}.tsx", "packages/browser/console/src/screens/{evidence,run-evidence,trace}.tsx", "packages/browser/console/src/routes/*evidence*.tsx", "packages/browser/elements/packages/content/src/media-viewer.tsx"]
---

## Rules

Bind evidence to its workspace, mech, session, run, tool call, and capture identity in trusted runtime code. Record pending
intent before capture. A repeated identity rejoins its existing outcome; it never silently captures a changed page.
Keep pending, ready, and failed states distinct. Claim saved evidence only after the expected bytes and digest are
validated in durable storage.
Treat an immutable media-integrity mismatch as a terminal failure. Distinguish it from a retryable storage transport
failure; retrying the same fixed bytes cannot repair their digest.
Commit ready state before releasing staging objects. A staging-cleanup failure cannot make verified media unavailable.
Retain bounded cleanup receipts, log the artifact identity without credentials, and retry on replay or authorized
metadata access. Cleanup must never delete the committed evidence object.

Keep explicit captures in private R2 objects under evidence ownership, separate from workspace generations. Ordinary
observations return transient previews and do not consume durable evidence capacity. Preserve ready
artifacts across machine replacement and workspace-generation cleanup. Bound individual artifacts and accumulation.
Keep object keys and authentication material out of model-visible links. Forks do not copy evidence ownership or active
capture state.

Check current workspace membership on every metadata and media read. Resolve the artifact within its admitted mech.
Return the same missing result for foreign and absent artifacts. A viewer URL grants no access. Preserve a validated
viewer destination through sign-in without allowing an arbitrary redirect.
Serve recognized viewer deep links through the Console entry point. Entering and leaving evidence keeps the same mech's
unsent draft and actual reader origin. A direct link returns to its run without synthesizing a Back loop.

Serve only declared media types with private, no-store caching, `nosniff`, and safe filenames. Authorize byte-range reads
before streaming video. Validate range bounds and distinguish a partial response from a complete file. Never expose a
public bucket URL as a substitute for an authenticated media route.

Stream private media across the standard Durable Object `fetch` boundary after service authentication and scoped
namespace binding. Keep metadata on JSON RPC. The object's fetch handler accepts only its canonical scoped media GET
route and rechecks the bound evidence owner before accessing R2. Preserve range and response headers without buffering
the whole artifact or returning a streaming `Response` through cross-object RPC.

Record runtime-observed capture time, machine, tab, URL, media size, digest, and dimensions. Record an observed Git head
and dirty state only from the actual inspected checkout; otherwise say that revision provenance is unavailable. A
checkout observation does not prove which revision a remote page serves. Model labels cannot supply verification.

Keep capture completion separate from application test success and deployed-revision verification. Put durable viewer
links in PRs through ordinary authorized application operations. Provider-specific attachment publication belongs to
the application CLI, outside Mechane. Unavailable native attachments never authorize another credential or public
disclosure implicitly. An explicitly approved provider copy has an independent access and revocation lifecycle.

## Checks

Review the domain evidence operations, authenticated Worker HTTP routes, and sandbox evidence store together.
Through the actual API, verify saved media remains readable after machine replacement, failed saves are unavailable,
and repeated capture identities do not create new content. Remove workspace membership and verify both metadata and
content reads fail, including byte-range requests. Check another mech's artifact has the same response as an absent one.

Exercise full, open-ended, suffix, and invalid video ranges. Follow a viewer link through sign-in. Inspect returned
provenance for an observed checkout and an unrelated URL. Confirm neither capture state nor a caller-provided label
becomes a test-pass assertion. Live PR qualification checks that an authorized reviewer can open the saved link.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
