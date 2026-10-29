import { Duration } from 'effect';

/** The same package-source destinations apply to every hosted machine provider. */
export const PACKAGE_SOURCE_HOSTS = [
  'github.com',
  '*.githubusercontent.com',
  'api.github.com',
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
] as const;

/** The deadline for a complete workspace checkpoint or restoration. */
export const WORKSPACE_OPERATION_TIMEOUT = Duration.minutes(5);

/** How long past a request's wait the sandbox waits for the guest's answer before it counts the request as failed. */
export const ANSWER_SLACK = Duration.seconds(5);
