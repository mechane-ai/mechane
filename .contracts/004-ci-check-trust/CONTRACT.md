---
name: ci-check-trust
message: Run complete required checks with explicit trust and no inherited cache or credential authority.
paths: [".github/**"]
---

## Rules

Run every job on an explicitly declared runner, and do not fall back to a runner with different trust or environment.
Pin third-party CI steps to immutable identifiers, such as full commit hashes or content digests, not tags or branches.
Grant each job only the repository permissions it needs.
Run native checks on their declared operating systems and architectures.

Run the complete check graph for pull requests, default-branch pushes, and manual runs.
Require every required job to succeed; a skipped, canceled, or missing required job is not success.
Make each required aggregate status depend on every required job, so that any failure fails the aggregate.
Propagate step failures instead of masking them with ignored exit codes or continue-on-failure settings.
Do not shorten a required check by omitting targets or reusing earlier results without complete dependency evidence and a full-check fallback.
Do not change shared quotas, runner profiles, or branch protection to make a check pass.
Preserve diagnostics and failure artifacts from failed checks.

Never let concurrency cancel a newer default-branch check, and keep retries and manual runs separate from ordinary supersession.
Give parallel jobs explicit joins, separate outputs, cancellation propagation, and cleanup ownership.
Do not share a mutable build output directory between concurrent jobs.
Clean up only the resources a job created.

Keep production and deployment credentials out of check jobs.
Start publishable checks with fresh execution state, and do not accept or upload remote cache results for them.
Never restore caches or executable results written by another repository or by pull-request jobs into a default-branch check.
Bind any trusted cache or remote execution to this repository's immutable identity and trust subject, verified by the infrastructure owner before it is enabled.
Fail closed when trusted-cache authorization is missing, and never fall back to a weaker cache.
Do not inherit another repository's identity-token subject or permissions.

## Checks

Inspect every workflow's triggers, runners, permissions, pinned step references, and required jobs.
Confirm that a failing, skipped, or canceled required job fails the required aggregate status.
Confirm that pull-request and manual runs cannot write caches or executable results that default-branch runs consume.
Confirm that check jobs receive no production credentials and no cache authority the infrastructure owner has not verified.

## Local adaptations

The required workflow, `.github/workflows/check.yml`, runs `mise run check` on `ubuntu-24.04` for pull requests, pushes to `main` and manual runs.
It grants `contents: read` only, pins third-party actions to full commit hashes, restores no cache, and receives no deployment credential.
Repository actions run from the checked-out source under `.github/actions`.
It checks out the full history and sets `MECHANE_BASE_BRANCH` to the pull request's target, or `main`, so the owned checks hold each ratchet's baseline to the merge base's.
Concurrency cancels only a superseded pull-request run, never a run on `main`.
The owned checks reject unpinned third-party actions, local action paths outside `.github/actions`, and workflows without `permissions`.
The owned mise bootstrap uses the read-only job token only with GitHub's API and follows an asset redirect without the
token. It verifies immutable release metadata, asset and published checksums, and the binary digest declared in
`.config/mise-release.sh` before executing the binary. The official pinned mise action consumes that verified local
installation; tool versions and package installation still follow the repository lockfiles.
When the check fails, a last step prints the retained local Node service and sandbox guest logs, so the run's log holds the stack's diagnostics.

The separate `publish-elements.yml` workflow runs only for published UI releases in the public `mechane-ai/mechane` repository.
Its publication job grants `contents: read` and `id-token: write`, uses a fresh `ubuntu-24.04` runner with no restored cache,
and authenticates to npm through its package-specific trusted publisher rather than a stored registry token.
The canonical builder must reproduce the immutable GitHub release asset's digest before publication. Existing npm
versions must match the same archive. Source pushes, pull requests, and runtime releases cannot publish the UI package;
the workflow does not deploy services or change installation state.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- owned check `workflows` (F004): enforced

<!-- End of the generated block. -->
