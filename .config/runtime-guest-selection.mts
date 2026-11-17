import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { guestImageInputs } from '../workspaces/core/packages/node/stack/src/guest-image-inputs.ts';

const repository = 'mechane-ai/mechane';
const sha256 = /^[a-f0-9]{64}$/;
const tagPattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const explicit = process.env.REUSE_GUEST_RELEASE;
const temporary = process.env.RUNNER_TEMP;
const output = process.env.GITHUB_OUTPUT;
if (process.env.GITHUB_REPOSITORY !== repository || !temporary || !output)
  throw new Error('Resolve guest reuse in the public runtime candidate workflow.');
const resultFile = output;

const directory = join(temporary, 'mechane-qualified-guest');
const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8' });
const read = (path: string) => JSON.parse(readFileSync(join(directory, path), 'utf8'));

async function selectGuest(): Promise<void> {
  const route = explicit ? 'releases/tags/' + explicit : 'releases/latest';
  if (explicit && !tagPattern.test(explicit)) throw new Error('Use an exact runtime release tag.');
  const release = JSON.parse(gh(['api', `repos/${repository}/${route}`]));
  const tag: string = release.tag_name;
  if (release.immutable !== true || release.draft !== false || !tagPattern.test(tag))
    throw new Error('Guest reuse requires an immutable qualified runtime release.');
  const assets: { name: string; digest: string | null }[] = release.assets;
  const qualification = assets.find(({ name }) => name === 'qualification.json')?.digest?.slice(7);
  if (!qualification || !sha256.test(qualification))
    throw new Error('Guest reuse needs the published qualification digest.');
  if (explicit && (explicit !== tag || qualification !== process.env.REUSE_GUEST_QUALIFICATION_SHA256))
    throw new Error('The selected guest qualification differs from the release.');

  mkdirSync(directory, { mode: 0o700 });
  function download(names: Iterable<string>) {
    for (const name of names)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(name))
        throw new Error('Unsafe pathname in previous guest qualification.');
    gh([
      'release',
      'download',
      tag,
      '-R',
      repository,
      '-D',
      directory,
      ...Array.from(names).flatMap((name) => ['--pattern', name]),
    ]);
  }
  download(['qualification.json', 'guest-inputs.json', 'artifacts.json']);
  function check(file: string, expected: string) {
    if (
      createHash('sha256')
        .update(readFileSync(join(directory, file)))
        .digest('hex') !== expected
    )
      throw new Error('Previous guest qualification metadata differs from its digest.');
  }
  check('qualification.json', qualification);
  const sealed = read('qualification.json');
  check('artifacts.json', sealed.artifacts.sha256);
  const inventory = read('artifacts.json');
  check(
    'guest-inputs.json',
    inventory.assets.find((asset: { name: string }) => asset.name === 'guest-inputs.json')?.sha256,
  );
  const current = await guestImageInputs({
    directory: join(import.meta.dirname, '../workspaces/core/packages/node/guest/image'),
    platform: 'linux/amd64',
  });
  if (!explicit && current.sha256 !== read('guest-inputs.json').inputs.sha256) {
    console.log('Guest build inputs changed. Build a fresh image.');
    return;
  }

  const required = new Set<string>([sealed.installation.path, `mechane-guest-${tag}.oci.tar`]);
  for (const input of Object.values(sealed.inputs) as { path: string }[][])
    for (const file of input) required.add(file.path);
  for (const check of sealed.checks) required.add(check.evidence.path);
  download(required);
  appendFileSync(resultFile, `directory=${directory}\nqualification=${qualification}\n`);
}

await selectGuest();
