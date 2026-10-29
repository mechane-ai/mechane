import { Duration } from 'effect';
import { fileURLToPath } from 'node:url';

/** The checks program's name, which prefixes each diagnostic its runs write. */
export const CHECKS_PROGRAM = 'checks';

/** The committed move map, relative to the workspace. */
export const MOVE_MAP = 'packages/node/package-moves/src/move-map.json';

/** The ast-grep configuration, relative to the workspace, which names the folder of the rules. */
export const AST_GREP_CONFIGURATION = 'sgconfig.yml';

/** The statuses a linter exits with once it has read every file: clean, or with findings. */
export const FINISHED_STATUSES: ReadonlySet<number> = new Set([0, 1]);

/**
 * The folder of the generated baselines, one `<rule>.json` for each ratchet, relative to the workspace; a plugin's
 * rule, such as `unicorn/no-array-callback-reference`, has its baseline in the plugin's folder.
 */
export const BASELINE_FOLDER = 'lint/baseline';

/** How the checks program ends: no finding, some findings, or an input it could not read. */
export const CheckStatus = { Clean: 0, Findings: 1, Failed: 2 } as const;

export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

/** The product workspace, whose paths every finding names relative to it. */
export const WORKSPACE_FOLDER = fileURLToPath(new URL('../../../../', import.meta.url));

/** The factory root, which holds the documents, workflows and pins the checks read. */
export const FACTORY_FOLDER = fileURLToPath(new URL('../../../../../../', import.meta.url));

/** The ignored folder that keeps what one run leaves for the next: the module graph and the green fingerprint. */
export const CACHE_FOLDER = fileURLToPath(new URL('../../../../node_modules/.cache/mechane/', import.meta.url));

/** The variable that names the branch whose merge base starts the changed set, and the branch it names unset. */
export const BASE_BRANCH = { variable: 'MECHANE_BASE_BRANCH', fallback: 'main' } as const;

/** How long one git command or one bundle may take. */
export const CHILD_TIMEOUT = Duration.minutes(1);

/** How long one run of a linter over the whole workspace may take. */
export const LINT_TIMEOUT = Duration.minutes(5);

/** The oxlint the workspace installs, by the `bin` its package declares. */
export const OXLINT = fileURLToPath(new URL('../../../../node_modules/oxlint/bin/oxlint', import.meta.url));

/** The ast-grep the workspace installs, by the `bin` its package declares. */
export const AST_GREP = fileURLToPath(new URL('../../../../node_modules/@ast-grep/cli/ast-grep', import.meta.url));

/** The slash a path relative to the workspace never ends with, though a folder's specifier does. */
export const TRAILING_SLASH = /\/$/;
