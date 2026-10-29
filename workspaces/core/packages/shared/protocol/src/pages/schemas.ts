import { renamedWireStruct, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { UserCode } from '../operations/auth/schemas.ts';
import { DeviceStep, TYPED_CODE_FIELD, TYPED_CODE_MAX_CHARS } from './constants.ts';

/** The review a signed-in browser asks for: the code its person typed, as typed, and its session's CSRF token. */
export const ReviewForm = renamedWireStruct({
  fields: {
    step: Schema.Literal(DeviceStep.Review),
    typedCode: Schema.String.check(Schema.isMaxLength(TYPED_CODE_MAX_CHARS)),
    csrfToken: Schema.String,
  },
  renames: { typedCode: TYPED_CODE_FIELD },
});

export type ReviewForm = typeof ReviewForm.Type;

/** The approval a review's button posts: the code it reviewed and the CSRF token of the session that rendered it. */
export const ApproveForm = wireStruct({
  fields: { step: Schema.Literal(DeviceStep.Approve), userCode: UserCode, csrfToken: Schema.String },
});

export type ApproveForm = typeof ApproveForm.Type;

/** A form the device page posts, by its step. */
export const DeviceForm = Schema.Union([ReviewForm, ApproveForm]);

export type DeviceForm = typeof DeviceForm.Type;
