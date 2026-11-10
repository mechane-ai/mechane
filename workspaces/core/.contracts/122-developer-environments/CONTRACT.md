---
name: developer-environments
message: Keep developer tools reproducible, files durable, and execution recovery independent of application-specific workflows.
paths: ["packages/shared/sandbox-wire/src/constants.ts", "packages/node/guest/image/{Dockerfile,*.sh}", "packages/node/guest/src/{executions,archives}/**", "packages/worker/sandbox/src/{checkpoints,executions,providers,egress}/**", "packages/worker/sandbox/src/workspace/snapshots/**", "packages/worker/sandbox/src/{constants,sandbox-object}.ts", "infrastructure/modules/cloudflare/**", "docs/agent-environments.md"]
---

## Rules

Keep the generic developer image in `node/guest/image`. Pin downloaded tools and verify architecture-specific checksums
before installing them. Use repository-owned setup for revision-specific dependencies. Company endpoints and agent
instructions belong to installation configuration, never the generic image or runtime.

Keep useful source, Git metadata, notes, and progress records in the committed home. Memory and work organization are
ordinary agent-managed files, not another runtime task or memory service. Keep internal model-context checkpoints in
the runtime store; their persistence does not establish file durability. Keep reproducible caches and build output outside
that home through explicit environment setup. Preserve existing files. Do not infer disposability from `.gitignore` or
silently exclude unknown files. Retain archive size limits and report failures instead of claiming files were committed.

Keep the expanded and compressed checkpoint bounds in the shared sandbox wire constants used by the guest and Worker.
Qualify a capacity change against streaming memory, home plus archive staging disk, part counts, and existing operation
deadlines on the selected machine tier. Scratch outside the home still consumes that machine's disk. Preserve unsaved
files before replacing a guest with older compiled limits; deploying a new Worker does not change that guest's bounds.

Advance checkpoint uploads and restoration copies in bounded sequential batches. Keep the persisted part format,
per-part validation, and durable cursor. Reload the current transfer after each awaited part; stop when its identity
changes, progress stalls, or an operation fails. Bound both parts per call and the time allowed to start another part.
An in-flight transfer retains its existing timeout. Buffer one part at a time and preserve interruption reconciliation.
Commit the complete generation and command receipt atomically, or activate a fully verified restoration, after the last
part without requiring another polling round. A batch boundary never establishes completion by itself.

Keep guest command duration distinct from time spent saving or restoring files. Performance evidence names archive
bytes, part count, and the measured boundary. Faster transfer scheduling cannot weaken the committed-file guarantee.

Supply additional HTTPS hosts through validated installation settings. Preserve authority validation, the private-network
boundary, and TLS verification. The gateway injects no credential and follows no redirect. Each redirect destination
must pass its own admission.

Observe an existing execution without resubmitting its command or requiring a serialized credential. Preserve execution
identity across transport retries. A missing receipt after a lost machine remains uncertain; never automatically rerun
an arbitrary command to reconstruct its output.

Qualify a real checkout on the selected hosted environment before describing that environment as able to build and ship
it. Required checks remain required. A missing Docker capability is an explicit qualification failure, not a passed
suite. Generic execution cannot establish exactly-once external writes or prove production from an assistant reply.

## Checks

Build the image and inspect pinned tool versions. Run the existing command-recovery and file-restoration smoke cases.
For a new workload, record source revision, commands, checkpoint size, restart results, and required-check outcomes in
the deployment work record. Inspect network configuration for company-specific values and review observation requests
for command bodies. Live release proof names the checked PR head, merge, workflow run, and observed deployed revision.
Exercise a multipart save and restoration across batch boundaries. Interrupt transfer after a stored part, cancel while
a part is in flight, and fail the final part. Verify retained cursors, restored files, and the absence of a premature
terminal receipt or activated partial home. Check batch limits without treating a timing sample as a latency promise.
For a raised capacity, save and restore a home exceeding the former bound, and retain explicit failures above each new
bound. Establish the tar-stream size from actual written data; a sparse file's logical length alone is insufficient.
Qualify a representative compressed archive near the accepted maximum separately from ordinary small smoke
fixtures. Record actual workload size and machine disk headroom; a local transfer measurement is not hosted qualification.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
