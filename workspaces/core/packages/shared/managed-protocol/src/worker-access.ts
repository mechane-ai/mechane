import { HttpHeader, HttpMethod } from '@mechane/records';
import {
  isInstalledWorkerComputerOperation,
  matchInstalledCommandEnvironment,
  readGitOperation,
} from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { matchManagedRoute } from './requests.ts';

type WorkerAccess = 'session_read' | 'tool_result' | 'memory' | 'skill' | 'file' | 'work';

const publicAccess: ReadonlyMap<string, WorkerAccess> = new Map([
  ['BetaGetSession', 'session_read'],
  ['BetaListEvents', 'session_read'],
  ['BetaStreamSessionEvents', 'session_read'],
  ['BetaSendEvents', 'tool_result'],
  ['BetaCreateMemory', 'memory'],
  ['BetaGetMemory', 'memory'],
  ['BetaListMemories', 'memory'],
  ['BetaUpdateMemory', 'memory'],
  ['BetaDeleteMemory', 'memory'],
  ['beta_get_skill_version_v1_skills__skill_id__versions__version__get', 'skill'],
  ['beta_download_skill_version_content_v1_skills__skill_id__versions__version__content_get', 'skill'],
  ['beta_get_file_metadata_v1_files__file_id__get', 'file'],
  ['beta_download_file_v1_files__file_id__content_get', 'file'],
  ['beta_acknowledge_work_v1_environments__environment_id__work__work_id__ack_post', 'work'],
  ['beta_record_heartbeat_v1_environments__environment_id__work__work_id__heartbeat_post', 'work'],
  ['beta_stop_work_v1_environments__environment_id__work__work_id__stop_post', 'work'],
]);

const SESSION_COMPUTER = /^\/internal\/managed\/sessions\/sesn_[a-zA-Z0-9_-]+\/computer\/(.+)$/u;
const WORK_CREDENTIAL = /^Bearer sk-ant-req-[A-Za-z0-9_-]+$/u;

const DENIED = 'denied';
type WorkerOperation = { readonly operation: string };
type WorkerRequest = { readonly request: Request };

/** Selects the resource scope that the application must authenticate for a worker operation. */
export function managedWorkerAccess({ operation }: WorkerOperation): WorkerAccess | typeof DENIED {
  const entry = publicAccess.get(operation);
  const access = Option.fromNullishOr(entry);

  return Option.getOrElse(access, (): typeof DENIED => DENIED);
}

/** Identifies the work credential format at the egress boundary without granting access. */
export function hasManagedWorkCredential({ request }: WorkerRequest): boolean {
  const header = request.headers.get(HttpHeader.Authorization);
  const credential = Option.fromNullishOr(header);

  return Option.isSome(credential) && WORK_CREDENTIAL.test(credential.value);
}

/** The application authenticates the live lease and resource after the gateway admits a worker route. */
export function canForwardManagedWorkerRequest({ request }: WorkerRequest): boolean {
  const { headers, method } = request;

  if (!hasManagedWorkCredential({ request }) || headers.has(HttpHeader.ApiKey) || headers.has(HttpHeader.Cookie)) {
    return false;
  }

  const url = new URL(request.url);
  const route = matchManagedRoute({ method, pathname: url.pathname, isConsole: false });

  if (Option.isSome(route)) {
    return publicAccess.has(route.value.operation);
  }

  const command = matchInstalledCommandEnvironment(url);

  if (method === HttpMethod.Get && url.search === '' && Option.isSome(command)) {
    return true;
  }

  const resource = SESSION_COMPUTER.exec(url.pathname);
  const computer = Option.fromNullishOr(resource).pipe(Option.flatMap((match) => Option.fromNullishOr(match[1])));

  if (Option.isSome(computer)) {
    return isInstalledWorkerComputerOperation({ method, resource: computer.value });
  }

  const git = readGitOperation({ request });

  return Option.isSome(git);
}
