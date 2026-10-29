import { KeyPurpose } from '@mechane/protocol';

/** What approving a device approval of each purpose does, as its page tells the person. */
export const PURPOSE_SUMMARY = {
  [KeyPurpose.Login]: 'sign the mechane CLI in on your machine',
  [KeyPurpose.Named]: 'create a named key for an agent or CI',
} as const;
