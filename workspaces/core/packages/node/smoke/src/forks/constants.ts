/**
 * The paths the scenario saves under: the parent's memory before the fork, the fork's own after it, and the parent's
 * after it.
 */
export const ScenarioPath = { Forked: 'facts/forked', Fork: 'facts/fork', Later: 'facts/later' } as const;
