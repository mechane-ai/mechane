# Mechane distribution

Builds installation artifacts from a clean, tagged checkout of the public source. Operators download a local runtime
archive or the cloud module and sandbox image. This is a node program at layer 7.

Run `mise -C workspaces/core run distribution:build` from the public checkout after publishing its source tag. The
publisher needs Docker Buildx with an OCI exporter, ZIP, and the pinned source tools. Output goes to
`dist/distribution/vVERSION`; an existing output directory is never overwritten.
`mise -C workspaces/core run distribution:verify -- OUTPUT` checks the artifact receipt, local archives, Worker bytes,
CLI binaries, and compatibility metadata without cloud credentials.

The module ZIP includes `installation.json`, the Worker, and notices. The guest is a separate Linux amd64 OCI archive.
The manifest binds both by SHA-256 and includes the append-only wire and migration locks. CLI binaries retain their
existing manifest format. Every revision in a release names the public source commit.

Local archives target macOS ARM64, Linux ARM64, and Linux x64. Each bundles the launcher, Worker, CLI, guest image,
`model.example.json`, and license notices. The celld binaries match the versions and checksums in `mise.lock`; their
upstream notices accompany them. The release also includes the versioned `setup-provider.sh` helper asset.

Building never publishes. A publisher uploads the verified assets to an immutable GitHub release. Keep registry
credentials and publication identities outside this package. Split packaging from verification if either exceeds its
package budget.
