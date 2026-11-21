---
name: managed-files-and-mounts
message: Store Managed Agents files in R2-backed workspace storage, serve downloads safely, and confine mounted inputs and exported outputs to the canonical session workspace.
paths: ["packages/worker/server/src/managed/{files,upload,session-resources}.ts", "packages/worker/managed-store/src/store/managed/{files,file-schema,vault-resources}.ts", "packages/shared/managed-protocol/src/worker-access.ts", "packages/node/guest/src/managed-work/{file-mount,mount-stage,file-export,session-tools}.ts"]
---

## Rules

Store uploaded Managed Agents file metadata in `mechane.managed_files` and prefer the R2 `WORKSPACE_FILES` bucket on Cloudflare Workers under strictly workspace-scoped object keys (`managed-files/<workspace_id>/<file_id>`), falling back to PostgreSQL `bytea` storage only when no object bucket is configured. Delete R2 objects if metadata insertion fails and clean up objects when files are deleted so storage cannot leak orphaned blobs.

Enforce explicit per-file size bounds before buffering and sanitize uploaded filenames with `finalPathComponent` so directory separators, traversal segments, and control characters never enter stored metadata or HTTP headers. Serve every file download with `X-Content-Type-Options: nosniff` and a sanitized `Content-Disposition: attachment` header; never serve uploaded user bytes as active HTML or script content under the control-plane origin.

Require workspace membership and creator-or-admin visibility for workspace-level file listing, metadata inspection, download, and deletion. Restrict scoped worker credentials (`sk-ant-req-*`) strictly to their active leased session: workers may read metadata and download content only for files explicitly mounted in that session's resources, may upload session outputs only with server-enforced `scope_type = 'session'` and `scope_id = <session_id>`, and must receive `403` on workspace file listings and deletions.

Confine every mounted session file inside the canonical `/workspace` directory via realpath containment, atomic temporary staging (`mount-stage.ts`), and symlink/traversal refusal so no mount path can escape `/workspace` or overwrite parent directories. Export files written to `/workspace/outputs/` while the work lease is still active (after mutating tool calls and during session tool teardown before lease release), rejecting symlinks, FIFOs, sockets, and device nodes, capping file count and byte volume, and deduplicating unchanged outputs by content hash.

## Checks

Exercise `POST /v1/files`, `GET /v1/files`, `GET /v1/files/{id}`, `GET /v1/files/{id}/content`, and `DELETE /v1/files/{id}` through the unmodified `@anthropic-ai/sdk` client, verifying R2 storage, response headers, workspace/creator isolation, and session resource mounting/removal.

Qualify a real container session that mounts an uploaded file at a path under `/workspace`, reads its exact contents inside the container, writes an artifact to `/workspace/outputs/`, rejects a symlink inside `/workspace/outputs/`, deduplicates an unchanged follow-up turn, and exposes the exported file via `GET /v1/files?scope_id=<session_id>`.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
