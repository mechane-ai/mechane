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

The subject's mech receives the case's input alone, as its one inbox item, with the suite's subject instructions, and its sandbox holds none of the run's files: the suite, the plan and every record stay in the out folder on the caller's machine, which no mech reaches.
A case's expectations reach only its grader's inbox item, which the eval scenario checks by finding no expectation's id or description in any subject's request to the upstream; the subject's mech is named for its role and the trial's id, a digest, never for the case.
The grader is a fresh mech with the release's fixed instructions, and its one inbox item holds the case's input, each expectation under its id and the subject's reply, cut with a marker past 32,768 characters; it receives no condition, no subject identity or settings, no prior grade and none of the subject's events or tool calls.
The suite names both models, and they differ, unless it sets `self_grading` to `true`, since a model a suite omits is the deployment's first offer, which no read reports; any other suite is `SuiteInvalid` before any call. The smoke's suite is self-grading, since the scripted upstream is one model.
No grader has been calibrated against fixed outputs, and no operation regrades a saved run.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
