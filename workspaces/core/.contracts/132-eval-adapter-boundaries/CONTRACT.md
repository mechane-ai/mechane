---
name: eval-adapter-boundaries
message: Keep application evaluation meaning in suites and reusable mechanics in the shared runner.
paths: ["packages/node/eval/**", "packages/node/smoke/src/evals/**"]
---

## Rules

Keep fixture behavior, evidence selection, grade validation, and label agreement in the application adapter.
The runner owns authenticated hosting, execution, durable records, recovery, and generic report accounting.
Accept those application decisions through the public `EvalSuite` and reporting callbacks. Do not import a consumer's
source or require its case names, environment variables, filesystem layout, or numeric score scale.

Validate the selected runtime origin before requesting readiness or binding an authenticated client. Local targets
use loopback origins; hosted targets use HTTPS. Reject embedded credentials, paths, queries, and fragments.
Application configuration chooses the workspace and transport explicitly. Never infer permission for hosted work from
failed local setup.

Fingerprint explicitly selected sources by their relative names and file contents. Reject empty selections, unmatched
patterns, and non-file entries. Preserve order independence and exclude dependency-installation directories.
Applications choose which sources affect results; CLI presentation and documentation are not fixture behavior.
Freeze the installed runner separately with `evalRunnerFingerprint`.

Derive calibration agreement from the saved audit's private labels and exact evidence digests. Let the application
compare a label with its grade. Count missing grades and unavailable comparisons separately from disagreement, and
show the compared and selected counts. Inspection does not reload current calibration files or invoke a model.
Keep that report separate from model inputs and from the immutable grade.
Hash only declared evidence contents when freezing a bundle. An existing digest or timestamp supplied with saved
evidence must not enter its new content digest. Reusing a saved bundle for calibration must remain readable afterward.

## Checks

The existing `gradesObservedToolEvidence` smoke exercises the public target factory, MCP execution, saved calibration
inspection, disagreement, and missing-grade accounting. Its invalid local target must fail before any network request.

Review source patterns beside the adapter's imports. Does every result-affecting callback have a fingerprinted owner?
Can a CLI-only edit invalidate the fixture? Can a changed label on disk alter a saved calibration result?
Check the SDK archive with a standalone consumer, using only its declared dependencies and public exports.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
