---
name: environment-startup
message: Keep computer preparation bounded, inspectable and independent of its readers.
paths: ["packages/shared/sandbox-wire/src/{startup,environment-state}.ts", "packages/shared/protocol/src/operations/environment/**", "packages/worker/runtime/src/operations/environment.ts", "packages/worker/sandbox/src/**", "packages/worker/sandbox-store/src/{machines,processes}/**", "packages/node/guest/src/**", "packages/browser/console-views/src/environment*.tsx", "packages/node/cli/src/runs/sandboxes/run-sandbox-show.ts", "packages/node/stack/src/capture-environment-reports.ts", "packages/node/testing/src/**", "packages/node/smoke/src/compute/**"]
---

## Rules

Keep preparation in the existing Sandbox machine lifecycle. Guest status describes tool preparation and file restoration;
only Sandbox admits a ready machine. Persist the original machine identity and startup deadline before starting it.
Retries rejoin that identity and retain its budget. Bootstrap and restoration each have a phase ceiling inside the
original overall deadline; observation and small progress updates never renew either ceiling. Keep shell execution duration separate from environment preparation.
Pi remains the agent execution owner.

Serve identity-bound guest preparation status before managed tools finish. Refuse commands during bootstrap. Record
phase changes, failures and actual transfer progress using the shared startup schemas. Bound retained steps and machine
reports. Use monotonic clocks for measured work within one invocation; UTC phase boundaries describe observations and
must not be presented as synchronized cross-process timings. Unknown durations remain unavailable.

Read the environment overview through `sandbox/src/inspection`. Its store input exposes query methods only. Keep runtime
operations outside that folder; its only runtime helper is the query-only inactive-checkpoint classifier. Inspection cannot join the execution queue, contact a guest,
renew its lease, repair a receipt or start work. Show process observations with their recorded freshness; fetch selected
process output independently. A failed optional observation cannot hide the stored environment report.

Store only validated phase names, tool names, identities, timestamps, durations, counts and fixed failure codes in startup
diagnostics. Exclude commands, output, paths, request bodies, URLs and credentials. Preserve command receipts, committed
files and recovery fences independently of diagnostic presentation. A missing terminal receipt remains uncertain.

Console and CLI consume the same single report, including optional recorded process status. An unavailable process
observation is distinct from a successful empty list. Reuse Console's canonical environment record and Elements presentation.
Present startup separately from saved-file durability. Draw completed timing intervals only with recorded endpoints;
ongoing phases remain explicitly open. Preserve ready content during refresh and display failures immediately.

## Checks

Run `mise run check:fast` from the factory root. Type checking restricts inspection's store authority and shared report
shapes; `sandbox-inspection-owner` enforces its import boundary. Run the existing interrupted-command and file-restoration
scenarios against a real celld guest. While a command is held, read environment status with a bounded request and verify
its original command identity. Restart owners and confirm files, the deadline and command receipts survive.

Hold tool preparation in a local fixture, read its guest status before releasing it, then verify one preparation and one
command. Fail preparation and require a bounded failure code without dispatch. Inspect restoration progress and retained
failure evidence. Compare fixed cold and warm workloads separately; performance samples do not establish hosted latency.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `sandbox-inspection-owner` (131): enforced: Read stored observations in inspection, such as `store.latestStartup()`; prepare computers through the machine owner (131)

<!-- End of the generated block. -->
