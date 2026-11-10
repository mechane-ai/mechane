---
name: evidence-export
message: Copy only this mech's verified durable evidence into its current home without recapture or provider authority.
paths: ["packages/shared/sandbox-wire/src/evidence-export.ts", "packages/node/guest/src/evidence/**", "packages/node/runtime/src/tools/export-evidence.ts", "packages/worker/sandbox/src/evidence/export-evidence.ts", "packages/worker/sandbox/src/sandbox-object.ts", "packages/worker/sandbox-service/src/evidence-route.ts"]
---

## Rules

Accept only an artifact identity from the model. Derive workspace and mech from trusted native tool context and require
current execution admission. Resolve only a ready capture owned by that mech before allocating compute or reading bytes.
Keep foreign, absent, pending, and failed captures unavailable through this interface.

Copy the durable original through the private sandbox transport, without public URLs, object keys, or member credentials.
Keep provider upload APIs, credential issuance, and scope policy outside Mechane. Generic credential custody belongs
to the workspace vault. Validate the guest's bounded bytes against the saved digest
and byte count before atomically replacing a fixed artifact file under its home. Never accept a caller-selected path.
Use the command gate so copying cannot race a frozen home checkpoint. Clean up temporary files after each attempt.

Return the exact copied path, digest, media type, byte count, and current machine identity. A response lost after copying
may safely repeat the same immutable copy; it must never recapture a browser page. A replacement machine can copy the
same durable original. Ready means the current machine's file was verified, not that a new home checkpoint committed.
Normal home persistence and its failures remain explicit. Failed or interrupted copies never report Ready. A known
guest integrity or input refusal is Failed, not an automatic polling loop over the same rejected bytes.

## Checks

Run the product type, lint, boundary, wire-lock, and compiled smoke checks. Exercise a saved capture through native
export and ordinary shell access, then compare its digest after replacing the environment and exporting again. Try a
foreign artifact and changed transfer bytes; neither may produce a ready file. Lose the copy response and repeat the
request to verify one stable file without a new capture. Keep the provider-copy qualification with its owning CLI.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
