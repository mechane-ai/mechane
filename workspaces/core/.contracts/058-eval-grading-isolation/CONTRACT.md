---
name: eval-grading-isolation
message: Keep expected outcomes from the assessed system, and condition, identity, and prior grades from the grader.
paths: ["packages/node/eval/src/**", "packages/node/smoke/src/evals/**"]
---

## Rules

Keep expected outcomes, rubrics, grading notes, and grader settings out of every input, file, manifest, instruction, and environment the assessed system can read.
Keep a case's expected outcomes, and those of related cases, out of its inputs in any file, format, or wording, including a synthetic case's task description.
Exclude the evaluation's own code, cases, and grading material from any source tree or version history the assessed system receives.
When a condition withholds material from the assessed system, remove it before creating the snapshot or version history that condition receives.
Store grading material and grades where the assessed system cannot reach them, including through shared volumes, mounts, and network routes.
Keep case names, difficulty labels, split assignments, and expected routing decisions private from the assessed system.

Grade from the exact frozen inputs the assessed system received, its completed output, and the rubric.
Withhold the condition or variant label, the case's split, and the assessed system's identity, version, and self-reported confidence from the grader.
Withhold the assessed system's intermediate activity and any summary of it from the grader unless a rubric dimension grades that activity.
Never send prior grades, human labels, or earlier audit results to the grader.
Restrict any grader lookup of supporting material to the case's frozen inputs, bound it, and freeze the retrieved bundle before grading.
Audit or regrade saved outputs from their frozen bundle and the recorded rubric, grader version, and grader settings, and change the grader only by explicit override.

Use a grader that shares no component that produced the assessed output, such as the same model, unless self-grading is the declared experiment.
Calibrate a new grader against fixed outputs with explicit expected judgments before relying on its scores.
Keep calibration expectations and their rationale out of the grader's inputs.

## Checks

Inspect the inputs, workspace, version history, and environment of one saved case for expected outcomes, rubrics, grader settings, case names, or split labels.
Can the assessed system reach grading material through any file, manifest, mount, environment variable, or network route?
Inspect one saved grader input and confirm that it lacks the condition label, the assessed system's identity and confidence, and any prior grade.
Regrade a saved run and confirm that the grader received the same frozen bundle and grader settings, with no earlier grade.
Confirm that the grader shares no producing component with the assessed system, or that self-grading is the declared experiment.

## Local adaptations

A suite supplies visible inputs separately from private rubrics. Only its visible input and this trial's recorded
calls reach the application environment. Fresh mechs use role/trial identities rather than case names and receive no
runner directory or other trial's context. A suite's evidence builder explicitly selects the assessed output; the
reply adapter selects an explicit Console publication, while application adapters select captured tool evidence.

Each fresh judge has `nativeTools: []` and only its private `submit_grade` MCP grant. Its model request receives the
frozen evidence value, rubric, and grade instructions/schema. Model identities, case labels, prior grades, and
calibration expectations remain outside that input. Subject diagnostic text stays private; a reply-grading suite
explicitly selects its public reply as assessed evidence.
Validate and persist a submitted grade before returning its receipt. Exact retries preserve it; a conflicting second
submission cannot replace it. Final prose alone is not a grade.

The suite declares different models unless it explicitly selects self-grading. Save requested and resolved identities;
provider weight revisions remain unavailable when the provider does not report them. `calibrateEval` and `regradeEval`
use the ordinary grading implementation and freeze their own audit manifest. Calibration expectations stay separate
from judge input, and audit records never overwrite source evidence or grades.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
