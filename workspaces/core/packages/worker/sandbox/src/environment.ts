type SecretBinding = { readonly get: () => Promise<string> };

export type SecretSource = string | SecretBinding;

export type SandboxRuntimeSettings = {
  readonly origin: string;
  readonly serviceKey: SecretSource;
  readonly transport: SecretSource;
};

export type SandboxEnvironment = {
  readonly WORKSPACE_FILES: R2Bucket;
  readonly MECHANE_SANDBOX_SERVICE_KEY: SecretSource;
  readonly MECHANE_RUNTIME_ORIGIN: string;
  readonly MECHANE_RUNTIME_TRANSPORT: SecretSource;
};
