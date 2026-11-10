import { WorkspaceManifest } from '@mechane/sandbox-store';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { Hex } from 'effect/encoding';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { WorkspaceFiles } from '../types.ts';
import { workspacePartKey } from './workspace-part-key.ts';

type ManifestInput = { readonly workspace: WorkspaceFiles; readonly manifest: WorkspaceManifest };
type VerifiedManifestInput = { readonly workspace: WorkspaceFiles; readonly snapshot: WorkspaceSnapshot };
const ManifestJson = Schema.fromJsonString(WorkspaceManifest);

/** Conditional creation makes a generation immutable even when an upload response is lost. */
export async function publishGenerationManifest({ workspace, manifest }: ManifestInput): Promise<string> {
  const body = Schema.encodeSync(ManifestJson)(manifest);
  const bytes = new TextEncoder().encode(body);
  const sha256 = await crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(sha256);
  const digest = Hex.encode(digestBytes);
  const key = manifestKey({ workspace, manifest });
  const result = await workspace.bucket.put(key, bytes, { sha256, onlyIf: { etagDoesNotMatch: '*' } });

  const uploaded = Option.fromNullishOr(result);

  if (Option.isNone(uploaded)) {
    const found = await workspace.bucket.get(key);
    const previous = Option.fromNullishOr(found);

    if (Option.isNone(previous)) {
      manifestFailure({ manifest, reason: 'immutable generation manifest disappeared during publication' });
    }

    const content = await previous.value.text();

    if (content !== body) {
      manifestFailure({ manifest, reason: 'immutable generation manifest conflicts with its checkpoint' });
    }
  }

  return digest;
}

/** A new-format head cannot activate files when its referenced manifest is absent or altered. */
export async function verifyGenerationManifest({ workspace, snapshot }: VerifiedManifestInput): Promise<void> {
  if (Option.isNone(snapshot.manifestSha256)) {
    return;
  }

  const key = manifestKey({ workspace, manifest: snapshot });
  const found = await workspace.bucket.get(key);
  const object = Option.fromNullishOr(found);

  if (Option.isNone(object)) {
    manifestFailure({ manifest: snapshot, reason: 'committed generation manifest is missing' });
  }

  const bytes = await object.value.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(hash);
  const digest = Hex.encode(digestBytes);
  const expected = Schema.encodeSync(ManifestJson)(snapshot);
  const body = new TextDecoder().decode(bytes);

  if (digest !== snapshot.manifestSha256.value || body !== expected) {
    manifestFailure({ manifest: snapshot, reason: 'committed generation manifest failed integrity verification' });
  }
}

function manifestKey({ workspace, manifest }: ManifestInput): string {
  const part = Option.none();
  const prefix = workspacePartKey({ owner: workspace.owner, generation: manifest.generation, part });

  return `${prefix}manifest.json`;
}

type ManifestFailureInput = { readonly manifest: WorkspaceManifest; readonly reason: string };

function manifestFailure({ manifest, reason }: ManifestFailureInput): never {
  const cause = new WorkspaceTransferFailed({ generation: manifest.generation, step: WorkspaceStep.Archive, reason });
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
