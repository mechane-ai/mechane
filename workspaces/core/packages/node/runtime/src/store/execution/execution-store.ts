import type { StoreContext } from '../context.ts';
import { createActivityStore } from './activity.ts';
import { createAdmissionStore } from './admissions.ts';
import { createRunLifecycle } from './lifecycle.ts';
import { createExecutionReads } from './reads.ts';

export function createExecutionStore(context: StoreContext) {
  return {
    ...createActivityStore(context),
    ...createAdmissionStore(context),
    ...createRunLifecycle(context),
    ...createExecutionReads(context),
  };
}
