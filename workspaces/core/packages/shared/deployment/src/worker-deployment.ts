/** Worker compatibility is shared by local hosts, artifacts, and installation metadata. */
const WORKER_COMPATIBILITY_DATE = '2026-10-28';

const DEFAULT_MAXIMUM_INSTANCES = 4;

type WorkerDeploymentInput = {
  readonly name: string;
  readonly entry: string;
  readonly variables?: Readonly<Record<string, string>>;
};

/** The environment resources used by either the combined application or local environment host. */
export type SandboxWorkerResources = {
  readonly image: string;
  readonly bucketName: string;
  readonly instanceType?: string;
  readonly maximumInstances?: number;
};

/** Local application hosts omit embedded environment resources and call their separate HTTP host. */
export type ApplicationWorkerDeploymentInput = WorkerDeploymentInput & {
  readonly assetsDirectory?: string;
  readonly sandbox?: SandboxWorkerResources;
};

/** The standalone local environment uses the same bindings and container description as the installation. */
export type SandboxWorkerDeploymentInput = WorkerDeploymentInput & SandboxWorkerResources;

type WorkerMigration = { readonly tag: string; readonly new_sqlite_classes: ReadonlyArray<string> };

type WorkerObjectBinding = { readonly name: string; readonly class_name: string };
type WorkerBucketBinding = { readonly binding: string; readonly bucket_name: string };

type WorkerContainer = {
  readonly class_name: string;
  readonly image: string;
  readonly instance_type: string;
  readonly max_instances: number;
};

type WorkerAssets = {
  readonly directory: string;
  readonly binding: string;
  readonly run_worker_first: true;
  readonly html_handling: 'none';
  readonly not_found_handling: 'none';
};

/** The declared Worker subset is checked by Wrangler and consumed unchanged by the local host. */
export type WorkerDeployment = {
  readonly name: string;
  readonly main: string;
  readonly compatibility_date: string;
  readonly compatibility_flags: ReadonlyArray<string>;
  readonly vars: Readonly<Record<string, string>>;
  readonly durable_objects: { readonly bindings: ReadonlyArray<WorkerObjectBinding> };
  readonly migrations: ReadonlyArray<WorkerMigration>;
  readonly r2_buckets?: ReadonlyArray<WorkerBucketBinding>;
  readonly containers?: ReadonlyArray<WorkerContainer>;
  readonly assets?: WorkerAssets;
  readonly triggers?: { readonly crons: ReadonlyArray<string> };
};

/** The production lineage retains the existing Sandbox namespace before adding the agent owner. */
export const APPLICATION_WORKER_MIGRATIONS: ReadonlyArray<WorkerMigration> = [
  { tag: 'v1', new_sqlite_classes: ['SandboxObject'] },
  { tag: 'v2', new_sqlite_classes: ['MechObject'] },
];

/** Preserves the environment namespace when the application joins an existing installation. */
export function applicationWorkerDeployment(input: ApplicationWorkerDeploymentInput): WorkerDeployment {
  const sandbox = input.sandbox;
  let embedded: Pick<WorkerDeployment, 'r2_buckets' | 'containers'> = {};
  let migrations: ReadonlyArray<WorkerMigration> = [{ tag: 'v1', new_sqlite_classes: ['MechObject'] }];
  const bindings: ReadonlyArray<WorkerObjectBinding> = [{ name: 'MECHS', class_name: 'MechObject' }];
  let environmentBindings: ReadonlyArray<WorkerObjectBinding> = [];

  if (sandbox !== undefined) {
    embedded = sandboxResources(sandbox);
    migrations = APPLICATION_WORKER_MIGRATIONS;
    environmentBindings = [{ name: 'SANDBOXES', class_name: 'SandboxObject' }];
  }

  let assets: Pick<WorkerDeployment, 'assets'> = {};

  if (input.assetsDirectory !== undefined) {
    assets = {
      assets: {
        directory: input.assetsDirectory,
        binding: 'ASSETS',
        run_worker_first: true,
        html_handling: 'none',
        not_found_handling: 'none',
      },
    };
  }

  return {
    ...baseWorkerDeployment(input),
    ...embedded,
    ...assets,
    durable_objects: { bindings: [...bindings, ...environmentBindings] },
    migrations,
    triggers: { crons: ['* * * * *'] },
  };
}

/** Runs environment commands through the same SandboxObject in an independently reloadable host. */
export function sandboxWorkerDeployment(input: SandboxWorkerDeploymentInput): WorkerDeployment {
  return {
    ...baseWorkerDeployment(input),
    ...sandboxResources(input),
    durable_objects: { bindings: [{ name: 'SANDBOXES', class_name: 'SandboxObject' }] },
    migrations: [{ tag: 'v1', new_sqlite_classes: ['SandboxObject'] }],
  };
}

function baseWorkerDeployment(
  input: WorkerDeploymentInput,
): Pick<WorkerDeployment, 'name' | 'main' | 'compatibility_date' | 'compatibility_flags' | 'vars'> {
  return {
    name: input.name,
    main: input.entry,
    compatibility_date: WORKER_COMPATIBILITY_DATE,
    compatibility_flags: ['nodejs_compat'],
    vars: input.variables ?? {},
  };
}

function sandboxResources(input: SandboxWorkerResources): Pick<WorkerDeployment, 'r2_buckets' | 'containers'> {
  return {
    r2_buckets: [{ binding: 'WORKSPACE_FILES', bucket_name: input.bucketName }],
    containers: [
      {
        class_name: 'SandboxObject',
        image: input.image,
        instance_type: input.instanceType ?? 'standard-1',
        max_instances: input.maximumInstances ?? DEFAULT_MAXIMUM_INSTANCES,
      },
    ],
  };
}
