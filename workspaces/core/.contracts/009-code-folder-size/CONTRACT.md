---
name: code-folder-size
message: Group source by ownership and behavior without file-count or depth quotas.
paths: ["**/*.ts"]
---

## Rules

Declare source roots in each workspace member. Group related modules in folders named for their behavior or resource.
Create a subfolder when it reduces the context needed to navigate a feature. Do not split a folder or create a package solely because of a file count or nesting depth.
Keep unrelated concerns out of catch-all folders. Preserve tool-required paths and generated files.

## Checks

For each new or moved folder, name the concept it owns and compare navigation for a representative change.
Confirm that runtime lanes, package imports, and storage ownership remain enforced.

## Local adaptations

The November 2, 2026 cohesion adoption replaces the upstream structural quotas with ownership and readability review.
Existing special-purpose files remain valid; changing a caller count does not require moving declarations.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
