import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const bashVersionDeclaration = {
  path: 'workspaces/core/packages/shared/bash/package.json',
  format: 'json',
  tagPrefix: 'bash-v',
} as const;

export function buildBashPackage(source: string, destination: string) {
  const root = resolve(source);
  const output = resolve(destination);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Build Bash by Mechane from a clean public checkout');
  const commit = git('rev-parse', 'HEAD');
  const core = join(root, 'workspaces/core');
  const sourcePackage = join(core, 'packages/shared/bash');
  const manifest = JSON.parse(readFileSync(join(root, bashVersionDeclaration.path), 'utf8'));
  assert.equal(manifest.name, '@mechane-ai/bash');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  execFileSync('pnpm', ['--filter', '@mechane-ai/bash', 'build'], { cwd: core, stdio: 'inherit' });
  const staged = join(output, 'package');
  cpSync(join(sourcePackage, 'dist'), join(staged, 'dist'), { recursive: true });
  copyFileSync(join(sourcePackage, 'README.md'), join(staged, 'README.md'));
  for (const name of ['LICENSE', 'NOTICE']) copyFileSync(join(root, name), join(staged, name));
  const { scripts, devDependencies, publishConfig, ...published } = manifest;
  assert.ok(scripts.build && devDependencies.typescript, 'Bash needs its canonical build and compiler');
  assert.equal(publishConfig.access, 'public');
  for (const [dependency, range] of Object.entries(published.dependencies)) {
    assert.equal(typeof range, 'string');
    assert.doesNotMatch(String(range), /^(workspace|file|link):/, `Publish ${dependency} with a registry version`);
  }
  const exports = { '.': { types: './dist/index.d.ts', import: './dist/index.js' } };
  writeFileSync(join(staged, 'package.json'), JSON.stringify({ ...published, exports }, null, 2) + '\n');
  const name = `mechane-bash-${manifest.version}.tgz`;
  const archive = join(output, name);
  execFileSync('pnpm', ['pack', '--out', archive], { cwd: staged, stdio: 'inherit' });
  const bytes = readFileSync(archive);
  const release = {
    commit,
    version: manifest.version,
    versionDeclaration: bashVersionDeclaration,
    body: `Bash by Mechane ${manifest.version}\n\nPi native Bash binding from public source ${commit}. The archive contains compiled ESM and TypeScript declarations with exact Pi dependencies. Install the archive as @mechane-ai/bash.`,
    assets: [{ path: archive, name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }],
  };
  writeFileSync(join(output, 'bash-release.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}
