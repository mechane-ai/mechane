import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const uiVersionDeclaration = {
  path: 'workspaces/core/packages/browser/ui/package.json',
  format: 'json',
  tagPrefix: 'ui-v',
} as const;

/** Builds the public UI package from the same component sources the Console consumes. */
export function buildUiPackage(source: string, destination: string) {
  const root = resolve(source);
  const output = resolve(destination);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Build Mechane UI from a clean public checkout');
  const commit = git('rev-parse', 'HEAD');
  const core = join(root, 'workspaces/core');
  const sourcePackage = join(core, 'packages/browser/ui');
  const manifest = JSON.parse(readFileSync(join(root, uiVersionDeclaration.path), 'utf8'));
  assert.equal(manifest.name, '@mechane-ai/ui');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  execFileSync('pnpm', ['--filter', '@mechane-ai/ui', 'build'], { cwd: core, stdio: 'inherit' });

  const staged = join(output, 'package');
  const distribution = join(staged, 'dist');
  cpSync(join(sourcePackage, 'dist'), distribution, { recursive: true });
  // StyleX hashes variable names from the package and defining path, which must match the compiled CSS.
  mkdirSync(join(staged, 'src'));
  copyFileSync(join(sourcePackage, 'src/tokens.stylex.ts'), join(staged, 'src/tokens.stylex.ts'));
  copyFileSync(join(sourcePackage, 'README.md'), join(staged, 'README.md'));
  copyFileSync(join(sourcePackage, 'styles.css'), join(staged, 'styles.css'));
  for (const name of ['LICENSE', 'NOTICE']) copyFileSync(join(root, name), join(staged, name));
  const { scripts, devDependencies, publishConfig, ...published } = manifest;
  assert.ok(scripts.build && devDependencies.typescript, 'Mechane UI needs its canonical build and compiler');
  writeFileSync(
    join(staged, 'package.json'),
    JSON.stringify({ ...published, exports: publishConfig.exports }, null, 2) + '\n',
  );
  const name = `mechane-ui-${manifest.version}.tgz`;
  const archive = join(output, name);
  execFileSync('pnpm', ['pack', '--out', archive], { cwd: staged, stdio: 'inherit' });
  const bytes = readFileSync(archive);
  const release = {
    commit,
    version: manifest.version,
    versionDeclaration: uiVersionDeclaration,
    body: `Mechane UI ${manifest.version}\n\nReact components, tokens, layouts, and charts from public source ${commit}. The archive contains compiled ESM, TypeScript declarations, and CSS. Install the archive as @mechane-ai/ui. UI releases have an independent version.`,
    assets: [
      { path: archive, name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length },
    ] as const,
  };
  writeFileSync(join(output, 'ui-release.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}
