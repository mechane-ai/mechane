# Mechane distribution

Builds installation artifacts from a clean, tagged checkout of the public source. Operators download the release module
and sandbox image; they do not need the product's build tools. This is a node program at layer 7.

Run `mise -C workspaces/core run distribution:build` from the public checkout after publishing its source tag. The
publisher needs Docker Buildx with an OCI exporter, ZIP, and the pinned source tools. Output goes to
`dist/distribution/vVERSION`; an existing output directory is never overwritten.
`mise -C workspaces/core run distribution:verify -- OUTPUT` checks the resulting artifact receipt, Worker bytes, CLI
binaries, and compatibility metadata without cloud credentials.

The module ZIP includes `installation.json`, the Worker, and notices. The guest is a separate Linux amd64 OCI archive.
The manifest binds both by SHA-256 and includes the append-only wire and migration locks. CLI binaries retain their
existing manifest format. Every revision in a release names the public source commit.

Building never publishes. A publisher uploads the verified assets to an immutable GitHub release. Keep registry
credentials and publication identities outside this package. Split packaging from verification if either exceeds its
package budget.
