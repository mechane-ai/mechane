import type { ManagedInputAttempt, RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import { EvalRole } from '../constants.ts';
import type { OnceFile } from '../types.ts';

type RoleFiles = {
  readonly intent: OnceFile<RoleIntent>;
  readonly receipt: OnceFile<RoleReceipt>;
  readonly inputAttempt: OnceFile<ManagedInputAttempt>;
  readonly record: OnceFile<RoleRecord>;
};

type SelectRoleFiles = { readonly context: RoleContext; readonly role: EvalRole };

export function selectRoleFiles({ context, role }: SelectRoleFiles): RoleFiles {
  const { files } = context;

  if (role === EvalRole.Subject) {
    return {
      intent: files.subjectIntent,
      receipt: files.subjectReceipt,
      inputAttempt: files.subjectInputAttempt,
      record: files.subject,
    };
  }

  return {
    intent: files.judgeIntent,
    receipt: files.judgeReceipt,
    inputAttempt: files.judgeInputAttempt,
    record: files.judge,
  };
}
