# Managed Agents wire fixture

`anthropic-v2.10.0.openapi.json.gz` is the unmodified OpenAPI 3.1 mock specification from the official Python SDK,
distributed under the adjacent Apache 2.0 license. The generator and SDK probe verify its bytes against
[the pinned checksum](upstream.sha256). Only the schema projections ship in the Worker.
[Pinned upstream file](https://github.com/anthropics/anthropic-sdk-python/blob/v2.10.0/scripts/mock-spec.json.gz)

Update the SDK pins, compressed bytes and digest together. Compare the smoke client's `inventory` output for changed
operations and review request, response and event schema changes in the upstream diff. Verify behaviors against the
published self-hosted feature matrix and run both SDKs against the local server.
[Self-hosted differences](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)

Run `node packages/shared/protocol/upstream/generate-requests.mjs` from `workspaces/core` to build the runtime request
schemas and sandbox tool inputs. Pass `--check` to verify both outputs. The request projection also includes the
documented self-hosted MCP identity fields and nullable session override lists.
[Agent identity](https://platform.claude.com/docs/en/managed-agents/self-hosted/agent-identity) ·
[Session overrides](https://platform.claude.com/docs/en/managed-agents/sessions)

The self-hosted server retains URL images, URL documents, and file-ID images in the public session history and omits
them from model input. Send base64 data to show the model an image or PDF, or send document text inline. A file-ID
document requires the hosted Files API. The managed session replay scenario checks the original public event and the
outgoing provider request separately.
[Self-hosted content differences](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)
