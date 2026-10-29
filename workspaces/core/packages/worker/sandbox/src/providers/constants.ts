/** The host launcher's request that a machine's call made: its start, which also reports it, or its stop. */
export const LauncherStep = { Start: 'start', Stop: 'stop' } as const;

export type LauncherStep = (typeof LauncherStep)[keyof typeof LauncherStep];
