import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildElementsPackage } from './elements-package.mts';

const [output, extra] = process.argv.slice(2);
assert.ok(output && !extra, 'Usage: elements-npm.mts NEW_OUTPUT_DIRECTORY');
assert.equal(process.env.GITHUB_EVENT_NAME, 'release', 'npm publication requires an explicit GitHub release');
assert.equal(process.env.GITHUB_REPOSITORY, 'mechane-ai/mechane');
const tag = process.env.GITHUB_REF_NAME;
assert.ok(tag && /^elements-v\d+\.\d+\.\d+$/.test(tag), 'npm publication requires a stable Elements release tag');

const root = resolve(import.meta.dirname, '..');
const release = buildElementsPackage(root, output);
assert.equal(tag, `elements-v${release.version}`, 'Release tag must match the package version');
assert.equal(release.commit, process.env.GITHUB_SHA, 'Build the release event’s source commit');
const asset = release.assets[0];
const response = await fetch(`https://api.github.com/repos/mechane-ai/mechane/releases/tags/${tag}`, {
  headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
});
assert.equal(response.status, 200, 'Read the published GitHub release before publishing to npm');
const published = await response.json();
assert.equal(published.immutable, true, 'Publish only immutable GitHub releases');
assert.equal(published.draft, false);
assert.equal(published.prerelease, false);
assert.equal(published.tag_name, tag);
const expected = published.assets.find((entry: { name: string }) => entry.name === asset.name);
assert.equal(expected?.digest, `sha256:${asset.sha256}`, 'Runner build must match the reviewed release archive');

const integrity = `sha512-${createHash('sha512').update(readFileSync(asset.path)).digest('base64')}`;
const registry = await fetch(`https://registry.npmjs.org/@mechane-ai%2felements/${release.version}`);
if (registry.status === 200) {
  const existing = await registry.json();
  assert.equal(existing.dist.integrity, integrity, 'An existing npm version must contain the same archive');
  console.log(`@mechane-ai/elements@${release.version} is already published with matching integrity`);
} else {
  assert.equal(registry.status, 404, 'Check npm version availability before publishing');
  execFileSync('npm', ['publish', asset.path, '--access', 'public', '--provenance'], { stdio: 'inherit' });
}
