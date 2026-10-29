import {
  DurationFromSeconds,
  memberOrUnknown,
  PAGE_RENAMES,
  PrintableName,
  RecordId,
  RecordName,
  renamedWireStruct,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import {
  KEY_NAME_MAX_CHARS,
  KEY_TOKEN_PATTERN,
  KeyPurpose,
  POLL_TOKEN_PATTERN,
  PollStatus,
  USER_CODE_PATTERN,
} from './constants.ts';

/** A key's name, such as `ci`, which its owner chooses to tell keys apart. */
export const KeyName = PrintableName.check(Schema.isBetweenLength(1, KEY_NAME_MAX_CHARS));

export type KeyName = typeof KeyName.Type;

/** A Mechane key; it stays redacted until the code that sends or saves it reads its value. */
export const KeyToken = Schema.RedactedFromValue(Schema.String.check(Schema.isPattern(KEY_TOKEN_PATTERN)));

export type KeyToken = typeof KeyToken.Type;

/** The secret with which the CLI that started a device approval claims its key. */
export const PollToken = Schema.RedactedFromValue(Schema.String.check(Schema.isPattern(POLL_TOKEN_PATTERN)));

export type PollToken = typeof PollToken.Type;

/** The code a person compares between the terminal and the approval page, such as `BCDF-GHJK`. */
export const UserCode = Schema.String.check(Schema.isPattern(USER_CODE_PATTERN));

export type UserCode = typeof UserCode.Type;

/** What a key's owner may know about it; the token itself is returned once, by the poll that claims it. */
export const KeyMetadata = wireStruct({
  fields: {
    id: RecordId,
    name: RecordName,
    purpose: memberOrUnknown({ set: KeyPurpose }),
    createdAt: WireTime,
    expiresAt: WireTime,
    /** None until the key's owner revokes it, which the wire sends as null. */
    revokedAt: Schema.OptionFromNullOr(WireTime),
  },
});

export type KeyMetadata = typeof KeyMetadata.Type;

/** The person a key acts for; its name is the GitHub login it signed up with. */
export const Principal = Schema.Struct({ id: RecordId, name: RecordName });

export type Principal = typeof Principal.Type;

/** A started device approval: the CLI shows the URL and code, then polls with the token at the interval. */
export const DeviceApproval = renamedWireStruct({
  fields: {
    userCode: UserCode,
    verificationUrl: Schema.URLFromString,
    pollToken: PollToken,
    interval: DurationFromSeconds,
    expiresIn: DurationFromSeconds,
  },
  renames: { interval: 'interval_seconds', expiresIn: 'expires_in_seconds' },
});

export type DeviceApproval = typeof DeviceApproval.Type;

const PendingPoll = Schema.Struct({ status: Schema.Literal(PollStatus.Pending) });

/** The one answer that carries the key's token: the poll that claims an approved device approval. */
export const ApprovedPoll = Schema.Struct({
  status: Schema.Literal(PollStatus.Approved),
  token: KeyToken,
  key: KeyMetadata,
  principal: Principal,
});

export type ApprovedPoll = typeof ApprovedPoll.Type;

/** What a poll answers: pending until the approval is approved, and then the key, once. */
export const DeviceApprovalPoll = Schema.Union([PendingPoll, ApprovedPoll]);

export type DeviceApprovalPoll = typeof DeviceApprovalPoll.Type;

/** The caller's principal and the key it authenticated with. */
export const PrincipalAnswer = Schema.Struct({ principal: Principal, key: KeyMetadata });

export type PrincipalAnswer = typeof PrincipalAnswer.Type;

/** The caller's keys, oldest first. */
export const KeyList = Schema.Struct({ keys: Schema.Array(KeyMetadata) });

export type KeyList = typeof KeyList.Type;

/** One page of the caller's keys, oldest first, and whether more follow it. */
export const KeyPage = renamedWireStruct({
  fields: { ...KeyList.fields, hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type KeyPage = typeof KeyPage.Type;
