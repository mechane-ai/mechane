import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const elementsVersionDeclaration = {
  path: 'workspaces/core/packages/browser/elements/package.json',
  format: 'json',
  tagPrefix: 'elements-v',
} as const;

/** Builds Elements from the same component sources the Console consumes. */
export function buildElementsPackage(source: string, destination: string) {
  const root = resolve(source);
  const output = resolve(destination);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain'), '', 'Build Elements by Mechane from a clean public checkout');
  const commit = git('rev-parse', 'HEAD');
  const core = join(root, 'workspaces/core');
  const sourcePackage = join(core, 'packages/browser/elements');
  const manifest = JSON.parse(readFileSync(join(root, elementsVersionDeclaration.path), 'utf8'));
  assert.equal(manifest.name, '@mechane-ai/elements');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  execFileSync('pnpm', ['--filter', '@mechane-ai/elements', 'build'], { cwd: core, stdio: 'inherit' });

  const staged = join(output, 'package');
  const distribution = join(staged, 'dist');
  cpSync(join(sourcePackage, 'dist'), distribution, { recursive: true });
  // StyleX hashes variable names from the package and defining path, which must match the compiled CSS.
  const tokenDefinition = manifest.exports['./tokens.stylex'];
  mkdirSync(dirname(join(staged, tokenDefinition)), { recursive: true });
  copyFileSync(join(sourcePackage, tokenDefinition), join(staged, tokenDefinition));
  copyFileSync(join(sourcePackage, 'README.md'), join(staged, 'README.md'));
  copyFileSync(join(sourcePackage, 'styles.css'), join(staged, 'styles.css'));
  for (const name of ['LICENSE', 'NOTICE']) copyFileSync(join(root, name), join(staged, name));
  const sonnerLicense = readFileSync(join(sourcePackage, 'node_modules/sonner/LICENSE.md'), 'utf8');
  writeFileSync(
    join(staged, 'NOTICE'),
    `${readFileSync(join(root, 'NOTICE'), 'utf8')}\nBundled Sonner\n\n${sonnerLicense}`,
  );
  const { scripts, devDependencies, publishConfig, ...published } = manifest;
  assert.ok(scripts.build && devDependencies.typescript, 'Elements by Mechane needs its canonical build and compiler');
  for (const [dependency, range] of Object.entries(published.dependencies)) {
    assert.equal(typeof range, 'string');
    assert.doesNotMatch(String(range), /^(workspace|file|link):/, `Publish ${dependency} with a registry version`);
  }
  assert.equal(publishConfig.access, 'public');
  const exports = Object.fromEntries(
    Object.entries(manifest.exports as Record<string, string>).map(([name, source]) => {
      if (name === './styles.css') return [name, './styles.css'];
      if (name === './tokens.stylex') return [name, source];
      const types = `./dist/${source.slice(2).replace(/\.tsx?$/, '.d.ts')}`;
      const entry = `./dist/${name === '.' ? 'index' : name.slice(2)}.js`;
      assert.ok(existsSync(join(staged, types)), `Missing declaration for ${name}`);
      assert.ok(existsSync(join(staged, entry)), `Missing bundle for ${name}`);
      return [name, { types, import: entry }];
    }),
  );
  writeFileSync(join(staged, 'package.json'), JSON.stringify({ ...published, exports }, null, 2) + '\n');
  const name = `mechane-elements-${manifest.version}.tgz`;
  const archive = join(output, name);
  execFileSync('pnpm', ['pack', '--out', archive], { cwd: staged, stdio: 'inherit' });
  const bytes = readFileSync(archive);
  const release = {
    commit,
    version: manifest.version,
    versionDeclaration: elementsVersionDeclaration,
    body: `Elements by Mechane ${manifest.version}\n\nReact components, tokens, layouts, and charts from public source ${commit}. The archive contains compiled ESM, TypeScript declarations, and CSS. Install the archive as @mechane-ai/elements. Elements releases have an independent version.`,
    assets: [
      { path: archive, name, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length },
    ] as const,
  };
  writeFileSync(join(output, 'elements-release.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}
