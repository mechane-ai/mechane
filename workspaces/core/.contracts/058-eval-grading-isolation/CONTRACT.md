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

Give each subject and judge a separate agent, session, and tool set. Pass only the visible input to the subject and
its application tools. The reply adapter takes its evidence from the subject's `agent.message` events. A session
that ends without reply text has no reply to grade. An application suite declares the observations its judge may see.

Offer the judge only the custom `submit_grade` tool. Its inputs are the frozen evidence, rubric, grade schema, and
instructions. Keep subject instructions, trial labels, private calibration expectations, and prior grades out of the
judge's input. Accept a grade only after schema and rubric validation. Persist it before sending a tool result.
An exact retry returns the original receipt. A conflicting submission leaves that grade intact. Judge prose cannot
create a grade.

Require explicit subject and judge models. Self-grading must be an explicit suite choice. Retain the resolved agent
version and model evidence the provider supplies. Calibration and regrading use the same grading implementation,
freeze their own inputs, and preserve the original evidence and grades.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
