/** The names of the keys the scenarios create, which `mechane key list` shows. */
export const ScenarioKey = { Expiring: 'expiring', Presented: 'presented', Sentinel: 'sentinel' } as const;

/** The text and the command the token scan's mech receives, which no line of the stack's log may hold. */
export const Sentinel = { Text: 'mechane-sentinel-text', Command: 'mechane-sentinel-command' } as const;
