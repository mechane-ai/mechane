/**
 * The steps of the device page's form: a signed-in browser reviews the approval of the code its person typed, and then
 * approves that approval from the review.
 */
export const DeviceStep = { Review: 'review', Approve: 'approve' } as const;

export type DeviceStep = (typeof DeviceStep)[keyof typeof DeviceStep];

/** The device page's field in which a person types the code their terminal shows. */
export const TYPED_CODE_FIELD = 'code';

/** The longest code the device page's form takes, well past a code with spaces around it. */
export const TYPED_CODE_MAX_CHARS = 32;

/** Console selections that can be shared across browser sessions. */
export const ConsoleView = {
  Conversation: 'conversation',
  Runs: 'runs',
  Environment: 'environment',
  Tools: 'tools',
  Activity: 'activity',
  Definition: 'definition',
  Requests: 'requests',
  Events: 'events',
} as const;

export type ConsoleView = (typeof ConsoleView)[keyof typeof ConsoleView];
