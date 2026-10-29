import { RELEASE } from '@mechane/protocol';
import { ReleaseStep } from '@mechane/release';
import { Duration } from 'effect';
import { fileURLToPath } from 'node:url';

/** The deploy program's name, which prefixes each line it writes to standard error. */
export const PROGRAM = 'deploy';

/**
 * The deploy program's modes: render production's configuration, check that this checkout can deploy it, deploy it, or
 * roll production back to an earlier version, or publish the CLI's built release.
 */
export const DeployMode = {
  Render: 'render',
  Preflight: 'preflight',
  Deploy: 'deploy',
  Rollback: 'rollback',
  Upload: 'upload',
} as const;

export type DeployMode = (typeof DeployMode)[keyof typeof DeployMode];

/** The product workspace, from which git names every path the program compares between releases. */
export const WORKSPACE_FOLDER = fileURLToPath(new URL('../../../../', import.meta.url));

/** The public installation example, used only by credential-free rendering. */
export const EXAMPLE_CONFIGURATION = fileURLToPath(
  new URL('../../../worker/app/cloudflare.example.jsonc', import.meta.url),
);

/** The configuration the program renders and deploys, in the app's ignored Wrangler folder. */
export const RENDERED_FOLDER = fileURLToPath(new URL('../../../worker/app/.wrangler/installations', import.meta.url));

/** The prefix of a release's tag, in git and on the Worker version it deploys, before the release itself. */
export const TAG_PREFIX = 'v';

/** The tag of the release this source declares, which only a checkout of that tag deploys. */
export const RELEASE_TAG = `${TAG_PREFIX}${RELEASE}`;

/** Wrangler's account credentials; installation secret references select every Worker credential separately. */
export const CREDENTIAL_VARIABLES = {
  cloudflareApiToken: 'CLOUDFLARE_API_TOKEN',
  cloudflareAccountId: 'CLOUDFLARE_ACCOUNT_ID',
} as const;

/** The variable that stops Wrangler sending usage metrics, which every Wrangler child receives. */
export const WRANGLER_METRICS = { WRANGLER_SEND_METRICS: 'false' } as const;

/** The prefix of each temporary folder the program creates, such as the one that holds the secrets file. */
export const TEMPORARY_PREFIX = 'mechane-deploy-';

/** The `user-agent` of the program's requests to production, which names the release it deploys. */
export const DEPLOY_USER_AGENT = `mechane-deploy/${RELEASE}`;

/** How long one git command may take; `ls-remote` and a fetch of `origin` wait on the network. */
export const GIT_NETWORK_TIMEOUT = Duration.minutes(1);

/** How long Wrangler may take for a read, such as a bucket's info or a version. */
export const WRANGLER_READ_TIMEOUT = Duration.minutes(2);

/** How long one request to production, Cloudflare's API or OpenRouter's may take. */
export const REQUEST_TIMEOUT = Duration.seconds(30);

/** Where Cloudflare's API and OpenRouter's key endpoint answer. */
export const API_ORIGINS = {
  cloudflare: 'https://api.cloudflare.com/client/v4',
  openRouterKey: 'https://openrouter.ai/api/v1/key',
} as const;

/**
 * The steps and checks of the deploy program, each as the diagnostic of its failure words it, with the steps of the
 * release its upload mode publishes.
 */
export const DeployStep = {
  ...ReleaseStep,
  ReadCommandLine: 'read the command line',
  ReadEnvironmentFileVariable: 'read the env file variable',
  ReadEnvironmentFile: 'read the env file',
  DecodeCredentials: 'credentials: decode the env file',
  RunMode: 'run the deploy program',
  PublishSandboxImage: 'publish the Tensorlake sandbox image',
  CheckCleanRevision: 'check that the rendered revision is clean',
  ReadWranglerConfiguration: 'read the Wrangler configuration',
  ReadOverlay: 'read the installation configuration',
  ReadWorkerRevision: 'read the Worker revision with git describe',
  WriteRenderedConfiguration: 'write the rendered configuration',
  DecodeRenderedVariables: "rendered: decode the rendered configuration's vars",
  RunGit: 'run git',
  RunWrangler: 'run wrangler',
  CreateTemporaryFolder: 'create a temporary folder',
  ReadReadiness: "read production's readiness",
  ReadOpenRouterCredit: 'openrouter: read the configured model key credit limit',
  FindReleasesBucket: 'find the releases bucket of the Wrangler configuration',
  ReadFormats: 'read the formats a revision declares',
  DecodeDeployments: "decode wrangler's deployments",
  ReadVersionTag: "read a version's release tag",
  CompareLocks: "append-only: compare the deployed revision's locks with HEAD's",
  ReadCloudflareAccount: 'cloudflare: read the account CLOUDFLARE_ACCOUNT_ID',
  CheckDeployedTag: 'deployed state: check the tag production runs',
  ListScripts: 'deployed state: list the scripts of CLOUDFLARE_ACCOUNT_ID',
  RunDockerInfo: 'dry run: docker info',
  CheckCleanTree: 'clean tree: git status --porcelain',
  CheckReleaseTag: 'tag: git describe --exact-match HEAD',
  ConfirmTag: 'confirm: type the tag',
  WriteSecretsFile: 'deploy: write the secrets file',
  SendTraffic: 'rollback: send all traffic to the earlier version; if a secret changed since, roll forward instead',
  CompareFormats:
    "rollback: compare the target's formats with the deployed tag's; roll forward with a patch release instead",
  ReadInstaller: 'served: read the install script',
  CheckServed: "served: check production's answers",
  ReadHealth: "served: read production's health",
  AwaitReadiness: 'readiness: await the deployed release',
  ReadBundle: 'record: read the Worker bundle',
} as const;

export type DeployStep = (typeof DeployStep)[keyof typeof DeployStep];
