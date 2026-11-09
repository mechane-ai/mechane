import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const api = 'https://api.github.com/repos/jdx/mise/releases';
const maximumAssetBytes = 128 * 1024 * 1024;

class BootstrapError extends Error {}

interface Asset {
  id: number;
  name: string;
  size: number;
  digest: string;
}

function digest(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readBytes(response: Response, limit: number) {
  if (!response.ok || !response.body) throw new BootstrapError(`GitHub download failed (${response.status})`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new BootstrapError('GitHub response exceeded the download limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function apiHeaders(token: string, accept: string) {
  return {
    'authorization': `Bearer ${token}`,
    accept,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'mise-bootstrap',
  };
}

async function download(asset: Asset, token: string) {
  if (
    !Number.isSafeInteger(asset.id) ||
    asset.id <= 0 ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0 ||
    asset.size > maximumAssetBytes ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest)
  )
    throw new BootstrapError('Release asset has no valid bounded SHA-256 identity');

  let response = await fetch(`${api}/assets/${asset.id}`, {
    headers: apiHeaders(token, 'application/octet-stream'),
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 302) {
    const location = new URL(response.headers.get('location') ?? '');
    if (
      location.protocol !== 'https:' ||
      location.hostname !== 'release-assets.githubusercontent.com' ||
      location.port ||
      location.username ||
      location.password
    )
      throw new BootstrapError('GitHub asset redirected outside its release CDN');
    await response.body?.cancel();
    response = await fetch(location, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
  }
  const bytes = await readBytes(response, asset.size);
  if (bytes.length !== asset.size || `sha256:${digest(bytes)}` !== asset.digest)
    throw new BootstrapError('GitHub asset size or SHA-256 did not match release metadata');
  return bytes;
}

export async function bootstrapMise(version: string, token: string, temporaryRoot: string, expectedSha256?: string) {
  if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(version)) throw new BootstrapError('An exact mise version is required');
  if (expectedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedSha256))
    throw new BootstrapError('Invalid binary SHA-256 pin');
  if (!token || !temporaryRoot) throw new BootstrapError('The job token and temporary directory are required');
  const platform = process.platform === 'darwin' ? 'macos' : process.platform;
  if (!['linux', 'macos'].includes(platform) || !['x64', 'arm64'].includes(process.arch))
    throw new BootstrapError('Unsupported mise runner platform');
  const assetName = `mise-v${version}-${platform}-${process.arch}.tar.gz`;
  const metadata = await fetch(`${api}/tags/v${version}`, {
    headers: apiHeaders(token, 'application/vnd.github+json'),
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  const release = JSON.parse((await readBytes(metadata, 2 * 1024 * 1024)).toString()) as {
    tag_name: string;
    immutable: boolean;
    draft: boolean;
    prerelease: boolean;
    assets: Asset[];
  };
  if (
    release.tag_name !== `v${version}` ||
    !release.immutable ||
    release.draft ||
    release.prerelease ||
    !Array.isArray(release.assets)
  )
    throw new BootstrapError('The exact immutable mise release is unavailable');
  const assets = release.assets.filter((asset) => asset.name === assetName);
  if (assets.length !== 1) throw new BootstrapError('The exact mise release asset is unavailable');
  const archive = await download(assets[0]!, token);
  const checksums = release.assets.filter((asset) => asset.name === 'SHASUMS256.txt');
  if (checksums.length > 1) throw new BootstrapError('The release checksum identity is ambiguous');
  if (checksums[0]) {
    const text = (await download(checksums[0], token)).toString();
    const expected = text.split(/\r?\n/).flatMap((line) => {
      const match = /^([a-f0-9]{64})\s+\*?(?:\.\/)?(.+)$/.exec(line);
      return match?.[2] === assetName ? [match[1]] : [];
    });
    if (expected.length !== 1 || expected[0] !== digest(archive))
      throw new BootstrapError('The mise archive did not match published release checksums');
  }

  const directory = await mkdtemp(join(temporaryRoot, `mise-bootstrap-${version}-`));
  try {
    const archivePath = join(directory, 'mise.tar.gz');
    const binaryPath = join(directory, 'bin', 'mise');
    await writeFile(archivePath, archive, { mode: 0o600 });
    await mkdir(join(directory, 'bin'), { mode: 0o700 });
    const output = await open(binaryPath, 'wx', 0o755);
    const env = { PATH: process.env.PATH, HOME: process.env.HOME };
    try {
      const extracted = spawnSync('tar', ['-xOzf', archivePath, 'mise/bin/mise'], {
        env,
        stdio: ['ignore', output.fd, 'pipe'],
        timeout: 30_000,
      });
      if (extracted.status !== 0) throw new BootstrapError('Could not extract the verified mise binary');
    } finally {
      await output.close();
    }
    await rm(archivePath);
    const sha256 = digest(await readFile(binaryPath));
    if (expectedSha256 !== undefined && sha256 !== expectedSha256)
      throw new BootstrapError('The verified mise binary did not match its existing SHA-256 pin');
    const reported = spawnSync(binaryPath, ['--version'], { env, encoding: 'utf8', timeout: 10_000 });
    if (reported.status !== 0 || reported.stdout.trim().split(/\s/)[0] !== version)
      throw new BootstrapError('The verified mise binary reported another version');
    return { version, directory, sha256 };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.main) {
  try {
    const result = await bootstrapMise(
      process.env.INPUT_VERSION ?? '',
      process.env.INPUT_GITHUB_TOKEN ?? '',
      process.env.RUNNER_TEMP ?? '',
      process.env.INPUT_SHA256 || undefined,
    );
    const outputs = Object.entries(result)
      .map(([key, value]) => {
        if (/[\r\n]/.test(value)) throw new BootstrapError('Invalid GitHub output value');
        return `${key}=${value}\n`;
      })
      .join('');
    await appendFile(process.env.GITHUB_OUTPUT!, outputs);
    console.log(`Verified mise ${result.version} against the immutable GitHub release.`);
  } catch (error) {
    console.error(
      error instanceof BootstrapError ? error.message : 'Mise bootstrap failed before the exact release was verified.',
    );
    process.exitCode = 1;
  }
}
