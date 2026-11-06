---
name: model-caching
message: Enable supported conversation caching without assuming a cache hit when reserving model spend.
paths: ["packages/worker/harness/src/models/**", "packages/worker/mech-ports/src/meter/**", "packages/node/smoke/src/mechs/**"]
---

## Rules

Configure model protocol compatibility in the harness adapter. Enable pi-ai's Claude cache protocol for `anthropic/`
offers even when the upstream URL or provider id is customized. Leave other offers on their supported protocol.
Use the SDK's cache placement and usage parsing instead of maintaining another message serializer.

Keep the provider session stable for one conversation and distinct for forks and drones. Cache hints must reach the
provider in the same request whose body the dispatch records. Preserve the original conversation and instructions.

Reserve spend without assuming a cache hit. Cover cache-write pricing as well as uncached input and full allowed
output. Settle reported cache reads and writes at their respective offer rates; a cache miss must remain affordable.

## Checks

Run `mise run check` from the repository root. The existing charged-inbox smoke uses an Anthropic-compatible scripted
offer and requires a trailing conversation cache hint on the recorded provider request. Fork coverage checks provider
session isolation. Review `bound-micros.ts` and `settled-events.ts` when changing cache accounting.

For hosted qualification, inspect reported cache usage across consecutive requests. A scripted request check proves
the protocol, not that a provider served a cache hit. Keep live measurements in the deployment work record.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
