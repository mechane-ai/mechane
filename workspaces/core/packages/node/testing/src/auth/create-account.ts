import { COMMAND_OUTPUTS } from '@mechane/cli-kernel';
import { TYPED_CODE_FIELD, WorkspaceList } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { runCli } from '../cli/run-cli.ts';
import { startCli } from '../cli/start-cli.ts';
import { signInBrowser } from './sign-in-browser.ts';
import type { Account, CreateAccountInput } from './types.ts';

const SavedCredential = Schema.Struct({ token: Schema.String });
const GROUP_AND_OTHER_PERMISSIONS_RANGE = 0o100;

export async function createAccount({ stack, login }: CreateAccountInput): Promise<Account> {
  const identity = login ?? stack.fixtures?.github.users.member.login;

  if (identity === undefined) {
    throw new Error('Account creation requires a local GitHub identity');
  }

  const configurationRoot = await mkdtemp(join(stack.stateDirectory, 'account-'));
  const account = { configurationRoot };
  const running = startCli({ stack, account, args: ['auth', 'login'] });

  try {
    const notice = await running.waitForApproval();
    const browser = await signInBrowser({ stack, login: identity });
    const codePage = await browser.request({ url: notice.url });
    const review = await browser.submit({ page: codePage, fields: { [TYPED_CODE_FIELD]: notice.userCode } });

    if (review.status !== HttpStatusCode.Ok) {
      throw new Error('The browser refused to review the device approval');
    }

    const approved = await browser.submit({ page: review });

    if (approved.status !== HttpStatusCode.Ok) {
      throw new Error('The browser refused the device approval');
    }

    const result = await running.finished;

    if (result.status !== 0) {
      throw new Error('The CLI could not claim the approved device key');
    }

    const envelope = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Struct({ result: COMMAND_OUTPUTS['auth login'] })),
    )(result.stdout);

    const credentialPath = envelope.result.credentialsFile;
    const savedPath = relative(configurationRoot, credentialPath);

    if (isAbsolute(savedPath) || savedPath === '..' || savedPath.startsWith('../')) {
      throw new Error('The CLI wrote its credential outside the isolated account folder');
    }

    const permissions = await stat(credentialPath);

    if (permissions.mode % GROUP_AND_OTHER_PERMISSIONS_RANGE !== 0) {
      throw new Error('The CLI credential file is readable by another user');
    }

    const credential = Schema.decodeUnknownSync(Schema.fromJsonString(SavedCredential))(
      await readFile(credentialPath, 'utf8'),
    );

    if (result.stdout.includes(credential.token) || result.stderr.includes(credential.token)) {
      throw new Error('The CLI printed its saved credential');
    }

    const listed = await runCli({ stack, account, args: ['workspace', 'list'], schema: WorkspaceList });
    const workspace = listed.workspaces.find((candidate) => candidate.name === identity);

    if (workspace === undefined) {
      throw new Error('Sign-in did not create the personal workspace');
    }

    return {
      login: identity,
      configurationRoot,
      token: credential.token,
      principalId: envelope.result.principal.id,
      workspaceId: workspace.id,
      keyId: envelope.result.key.id,
      browser,
    };
  } finally {
    await running.stop();
  }
}
