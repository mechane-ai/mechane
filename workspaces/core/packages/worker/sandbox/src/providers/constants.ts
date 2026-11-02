/** The host launcher operation that failed. */
export const LauncherStep = { Start: 'start', Inspect: 'inspect', Stop: 'stop' } as const;

export type LauncherStep = (typeof LauncherStep)[keyof typeof LauncherStep];
