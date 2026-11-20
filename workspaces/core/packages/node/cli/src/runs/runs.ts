import type { Run } from '@mechane/cli-kernel';
import { runAuthLogin, runAuthLogout, runAuthStatus } from '@mechane/cli-login';
import { runUpdate } from '@mechane/cli-update';
import type { CommandName } from '@mechane/commands';
import { runCredentialDelete } from './credentials/run-credential-delete.ts';
import { runCredentialList } from './credentials/run-credential-list.ts';
import { runCredentialPut } from './credentials/run-credential-put.ts';
import { documentRun } from './document-run.ts';
import { runExecutionAccessRevoke, runExecutionAccessSet } from './execution-access/run-execution-access-set.ts';
import { runExecutionAccessShow } from './execution-access/run-execution-access-show.ts';
import { runKeyCreate } from './keys/run-key-create.ts';
import { runKeyList } from './keys/run-key-list.ts';
import { runKeyRevoke } from './keys/run-key-revoke.ts';
import {
  runServicePrincipalRevoke,
  runServicePrincipalRotate,
  runServicePrincipalShow,
} from './keys/run-service-principal.ts';
import { runEvalCompare } from './run-eval-compare.ts';
import { runEvalInspect } from './run-eval-inspect.ts';
import { runEvalRun } from './run-eval-run.ts';
import { runReadiness } from './run-readiness.ts';
import { runAgentPolicySet, runAgentPolicyShow } from './workspaces/run-agent-policy.ts';
import { WORKSPACE_RUNS } from './workspaces/workspace-runs.ts';

/** The run of each command; a command without one fails to compile. */
type Runs = { readonly [N in CommandName]: Run<N> };

/** The run of each command; a command without one fails to compile. Only a command that streams writes as it goes. */
export const RUNS: Readonly<Runs> = {
  'agent-policy show': documentRun({ run: runAgentPolicyShow }),
  'agent-policy set': documentRun({ run: runAgentPolicySet }),
  'execution-access show': documentRun({ run: runExecutionAccessShow }),
  'execution-access revoke': documentRun({ run: runExecutionAccessRevoke }),
  'execution-access set': documentRun({ run: runExecutionAccessSet }),
  'credential put': documentRun({ run: runCredentialPut }),
  'credential list': documentRun({ run: runCredentialList }),
  'credential delete': documentRun({ run: runCredentialDelete }),
  'readiness': documentRun({ run: runReadiness }),
  'auth login': documentRun({ run: runAuthLogin }),
  'auth status': documentRun({ run: runAuthStatus }),
  'auth logout': documentRun({ run: runAuthLogout }),
  'key create': documentRun({ run: runKeyCreate }),
  'key list': documentRun({ run: runKeyList }),
  'key revoke': documentRun({ run: runKeyRevoke }),
  'service-principal show': documentRun({ run: runServicePrincipalShow }),
  'service-principal rotate': documentRun({ run: runServicePrincipalRotate }),
  'service-principal revoke': documentRun({ run: runServicePrincipalRevoke }),
  ...WORKSPACE_RUNS,
  'eval run': runEvalRun,
  'eval inspect': runEvalInspect,
  'eval compare': runEvalCompare,
  'update': documentRun({ run: runUpdate }),
};
