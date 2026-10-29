import { IdentityProvider } from '@mechane/records';
import { Schema } from 'effect';

/** Provider subjects remain stable when a person changes their display name. */
const IdentitySubject = Schema.Struct({ provider: Schema.Enum(IdentityProvider), subject: Schema.NonEmptyString });

/** A stable subject is meaningful only within its issuing identity provider. */
export type IdentitySubject = typeof IdentitySubject.Type;

/** The configured provider subjects are compared exactly; an empty list grants no admission. */
export const IdentitySubjects = Schema.Array(IdentitySubject);
export type IdentitySubjects = typeof IdentitySubjects.Type;

/** Installation files encode the allowlist as JSON without provider credentials. */
export const IdentitySubjectsVariable = Schema.fromJsonString(IdentitySubjects);

export type IdentitySubjectsVariable = typeof IdentitySubjectsVariable.Type;
