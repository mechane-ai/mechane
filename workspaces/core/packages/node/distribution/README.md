# Mechane distribution

Builds immutable Node, compute, guest, and CLI artifacts from a clean public source tag. Operators install the compiled
bytes without a source checkout or package installation. This is a Node program at layer 7.

Run `mise -C workspaces/core run distribution:build` from the public checkout after publishing its source tag. The
publisher needs Docker Buildx with an OCI exporter, tar, ZIP, and the pinned tools. Output goes to
`dist/distribution/vVERSION`; an existing directory is never overwritten.

The release contains:

- `mechane-node-vVERSION.tar.gz`: compiled HTTP service, Workflow bundle, database setup commands, console assets,
  dependencies, and required notices. `runtime.json` records every file's path, size, and SHA-256. The archive has no
  links.
- `release.json`: the Node archive's digest, source revision, required Node version, and executable entrypoints.
- `mechane-cloudflare-vVERSION.zip`: the compute and ingress module, its Worker bundle, and `installation.json`.
- The Linux amd64 guest OCI archive, CLI binaries and manifest, and the versioned provider setup helper.

`mise -C workspaces/core run distribution:verify -- OUTPUT` checks the complete artifact receipt and every Node archive
file. It rejects unsafe paths, links, duplicate entries, missing bytes, and mismatched provenance before publication.
The Cloudflare manifest binds the Worker and guest image to their checksums. Every source revision names the public
commit.

Building never publishes. A publisher uploads verified assets to an immutable GitHub release. Registry credentials and
publication identities remain outside this package.
