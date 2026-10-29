/** The annotations of a Worker version or deployment: the tag it was deployed under, and why it was deployed. */
export const DeploymentAnnotation = { Tag: 'workers/tag', Message: 'workers/message' } as const;

/** The files the program reads at a release's revision for its formats, relative to the product workspace. */
export const FormatPath = { WranglerConfiguration: 'packages/worker/app/wrangler.jsonc' } as const;
