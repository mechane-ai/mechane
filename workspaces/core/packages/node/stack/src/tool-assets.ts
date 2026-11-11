import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  SANDBOX_TOOL_LIMITS,
  SandboxTool,
  SandboxToolArchive,
  SandboxTools,
  SandboxToolTarget,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { GuestGateway } from './guest-gateway.ts';
import type { GuestHttpFixture, LocalToolAsset } from './types.ts';

const ARCHIVE_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);

const LocalAsset = Schema.Struct({
  name: SandboxTool.to.fields.name,
  version: SandboxTool.to.fields.version,
  versionOutput: SandboxTool.to.fields.versionOutput,
  target: Schema.Literals([SandboxToolTarget.LinuxArm64, SandboxToolTarget.LinuxX64]),
  archivePath: Schema.NonEmptyString.check(
    Schema.makeFilter(isAbsolute, { expected: 'an absolute local tool archive path' }),
  ),
  sha256: SandboxToolArchive.fields.sha256,
  executable: SandboxToolArchive.fields.executable,
});

type LocalAsset = typeof LocalAsset.Type;

const LocalAssets = Schema.Array(LocalAsset).check(Schema.isMaxLength(SANDBOX_TOOL_LIMITS.maxEntries));
type LocalAssets = typeof LocalAssets.Type;

const ArchiveBytes = Schema.Int.check(
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(SANDBOX_TOOL_LIMITS.maxArchiveBytes),
);

type ArchiveBytes = typeof ArchiveBytes.Type;

type RegisterToolAssetsInput = { readonly assets: ReadonlyArray<LocalToolAsset>; readonly gateway: GuestGateway };

export type ToolAssetRegistration = { readonly tools: ReadonlyArray<SandboxTool>; readonly close: () => Promise<void> };

export async function registerToolAssets({ assets, gateway }: RegisterToolAssetsInput): Promise<ToolAssetRegistration> {
  const decoded = Schema.decodeUnknownSync(LocalAssets, { onExcessProperty: 'error' })(assets);

  const prepared = await Promise.all(
    decoded.map(async (asset) => {
      const information = await stat(asset.archivePath);

      if (!information.isFile()) {
        throw new Error(`The local tool archive is not a regular file: ${asset.archivePath}`);
      }

      Schema.decodeUnknownSync(ArchiveBytes, { onExcessProperty: 'error' })(information.size);

      const contents = await readFile(asset.archivePath);

      Schema.decodeUnknownSync(ArchiveBytes, { onExcessProperty: 'error' })(contents.byteLength);

      const sha256 = createHash('sha256').update(contents).digest('hex');

      if (sha256 !== asset.sha256) {
        throw new Error(`The local tool archive checksum does not match ${asset.archivePath}`);
      }

      return { asset, contents: new Uint8Array(contents) };
    }),
  );

  const fixtures: Array<GuestHttpFixture> = [];

  async function close(): Promise<void> {
    const failures: Array<unknown> = [];

    for (const fixture of fixtures) {
      try {
        await fixture.close();
      } catch (cause) {
        failures.push(cause);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'The local tool archive routes could not close');
    }

    fixtures.length = 0;
  }

  try {
    const tools = prepared.map(({ asset, contents }) => {
      const fixture = gateway.registerFixture(async (request) => {
        if (!ARCHIVE_METHODS.has(request.method)) {
          return new Response(null, { status: HttpStatusCode.MethodNotAllowed });
        }

        const headers = {
          [HttpHeader.ContentType]: MediaType.OctetStream,
          [HttpHeader.ContentLength]: String(contents.byteLength),
        };

        if (request.method === HttpMethod.Head) {
          return new Response(null, { headers });
        }

        return new Response(contents, { headers });
      });

      fixtures.push(fixture);

      return {
        name: asset.name,
        version: asset.version,
        versionOutput: asset.versionOutput,
        targets: { [asset.target]: { url: fixture.url, sha256: asset.sha256, executable: asset.executable } },
      };
    });

    const schema = Schema.toType(SandboxTools);
    const decodedTools = Schema.decodeUnknownSync(schema, { onExcessProperty: 'error' })(tools);

    return { tools: decodedTools, close };
  } catch (cause) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError([cause, cleanupError], 'The local tool registration and its route cleanup failed', {
        cause: cleanupError,
      });
    }

    throw cause;
  }
}
